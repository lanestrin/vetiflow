import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as casesApi from "../../services/casesApi";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { buildCaseDetail, buildPainScore } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import { RecordPainScoreDialog } from "./RecordPainScoreDialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => sessionStorage.clear());

const path = apiUrl("/api/cases/case-42/pain-scores");
const scoreInput = () => screen.getByRole("combobox", { name: "Pain score (0 to 10)" });
const choose = (value: string) => fireEvent.change(scoreInput(), { target: { value } });
const notes = (value: string) => fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save pain score" }));

function renderDialog() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onUnavailable = vi.fn();
  const detail = buildCaseDetail({ id: "case-42", caseNumber: "ER-42", latestPainScore: buildPainScore() });
  const view = render(<MemoryRouter><Routes>
    <Route path="/" element={<RecordPainScoreDialog detail={detail} onClose={onClose} onSaved={onSaved} onUnavailable={onUnavailable} />} />
    <Route path="/sign-in" element={<p>Sign-in page</p>} />
    <Route path="/pet-parent" element={<p>Pet parent home</p>} />
  </Routes></MemoryRouter>);
  return { ...view, onClose, onSaved, onUnavailable };
}

function serve(status = 201, body?: unknown) {
  const sent: unknown[] = [];
  server.use(http.post(path, async ({ request }) => {
    sent.push(await request.json());
    return body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
  }));
  return sent;
}

function deferredWrite() {
  let finish!: (response: Response) => void;
  const response = new Promise<Response>(resolve => { finish = resolve; });
  const sent: unknown[] = [];
  server.use(http.post(path, async ({ request }) => { sent.push(await request.json()); return response; }));
  return { sent, finish: (status = 201) => finish(new HttpResponse(null, { status })) };
}

describe("RecordPainScoreDialog", () => {
  it("opens blank for this case without selecting zero or the previous assessment", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Record pain score" })).toBeVisible();
    expect(screen.getByText(/Case ER-42/)).toBeInTheDocument();
    expect(scoreInput()).toHaveValue("");
    expect(scoreInput()).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(12);
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("");
    expect(screen.getByText("Use the clinic's approved species-specific scale.")).toBeInTheDocument();
  });

  it("requires an explicit score even when notes are present", () => {
    const sent = serve();
    renderDialog();
    notes("Brief demo note");
    save();
    expect(scoreInput()).toHaveAttribute("aria-invalid", "true");
    expect(scoreInput()).toHaveAccessibleDescription("Choose a whole-number score from 0 to 10.");
    expect(scoreInput()).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it.each([0, 5, 10])("saves explicitly selected %i and omits blank notes", async score => {
    const sent = serve();
    const { onSaved } = renderDialog();
    choose(String(score));
    notes("   ");
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ score }]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("trims a new note and sends no recorder, timestamp or previous values", async () => {
    const sent = serve();
    const { onSaved } = renderDialog();
    choose("4");
    notes("  Brief demo observation  ");
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ score: 4, notes: "Brief demo observation" }]);
  });

  it.each(["-1", "11", "4.5", "NaN", "Infinity"])("refuses a tampered selector value %s", value => {
    const sent = serve();
    renderDialog();
    // The handler also validates values introduced outside the normal options.
    const option = document.createElement("option");
    option.value = value;
    option.text = value;
    scoreInput().appendChild(option);
    choose(value);
    save();
    expect(scoreInput()).toHaveAttribute("aria-invalid", "true");
    expect(scoreInput()).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it("accepts a 500-character note", async () => {
    const sent = serve();
    const { onSaved } = renderDialog();
    choose("4");
    notes("x".repeat(500));
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ score: 4, notes: "x".repeat(500) }]);
  });

  it("refuses overlong notes before posting", () => {
    const sent = serve();
    renderDialog();
    choose("4");
    notes("x".repeat(501));
    save();
    const input = screen.getByLabelText("Notes (optional)");
    expect(input).toHaveAccessibleDescription("Use 500 characters or fewer.");
    expect(input).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it("maps JSON and case-insensitive field errors and retains both values", async () => {
    serve(400, { errors: { "$.Score": ["Score was refused."], nOtEs: ["Notes were refused."] } });
    const { onSaved } = renderDialog();
    choose("4");
    notes("Brief demo note");
    save();
    await screen.findByText("Score was refused.");
    expect(scoreInput()).toHaveValue("4");
    expect(scoreInput()).toHaveAccessibleDescription("Score was refused.");
    expect(scoreInput()).toHaveFocus();
    expect(screen.getByLabelText("Notes (optional)")).toHaveAccessibleDescription("Notes were refused.");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Brief demo note");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("focuses notes when only that field is refused", async () => {
    serve(400, { errors: { Notes: ["Notes were refused."] } });
    renderDialog();
    choose("4");
    save();
    await screen.findByText("Notes were refused.");
    expect(screen.getByLabelText("Notes (optional)")).toHaveFocus();
  });

  it.each([400, 500, "network"])("keeps the draft after %s and allows a manual retry", async status => {
    const sent = status === "network" ? [] : serve(status as number);
    if (status === "network") server.use(http.post(path, () => HttpResponse.error()));
    const { onSaved } = renderDialog();
    choose("4");
    notes("Brief demo note");
    save();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save pain score. Try again.");
    expect(scoreInput()).toHaveValue("4");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Brief demo note");
    expect(sent).toHaveLength(status === "network" ? 0 : 1);
    expect(onSaved).not.toHaveBeenCalled();
    const retry = serve();
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(retry).toEqual([{ score: 4, notes: "Brief demo note" }]);
  });

  it.each([[404, "This case is no longer on the board."], [409, "This case has been discharged."]] as const)(
    "requests a refresh after %s and refuses further writes", async (status, message) => {
      const sent = serve(status);
      const { onUnavailable, onSaved } = renderDialog();
      choose("4");
      save();
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(onUnavailable).toHaveBeenCalledOnce();
      expect(onSaved).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Save pain score" })).toBeDisabled();
      fireEvent.submit(screen.getByRole("form"));
      expect(sent).toHaveLength(1);
    });

  it.each([[401, "Sign-in page"], [403, "Pet parent home"]] as const)("leaves on session refusal %s", async (status, page) => {
    serve(status);
    saveAccessToken("expired-or-denied");
    const { onSaved } = renderDialog();
    choose("4");
    save();
    expect(await screen.findByText(page)).toBeInTheDocument();
    expect(readAccessToken()).toBe(status === 401 ? null : "expired-or-denied");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each(["Cancel", "Close pain score form", "Escape", "backdrop"])("discards via %s without saving", method => {
    const sent = serve();
    const { onClose, onSaved } = renderDialog();
    choose("4");
    if (method === "Escape") fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    else if (method === "backdrop") fireEvent.click(screen.getByRole("dialog"));
    else fireEvent.click(screen.getByRole("button", { name: method }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("blocks duplicate submits, edits and every dismissal while saving", async () => {
    const write = deferredWrite();
    const { onClose, onSaved } = renderDialog();
    choose("4");
    save();
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close pain score form" })).toBeDisabled();
    expect(scoreInput()).toBeDisabled();
    expect(screen.getByLabelText("Notes (optional)")).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(write.sent).toHaveLength(1));
    await act(async () => { write.finish(); });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([201, 401, 404, 409, 500])("ignores late response %s after unmount", async status => {
    const write = deferredWrite();
    const request = vi.spyOn(casesApi, "recordPainScore");
    const { unmount, onSaved, onClose, onUnavailable } = renderDialog();
    choose("4");
    save();
    await waitFor(() => expect(write.sent).toHaveLength(1));
    unmount();
    await act(async () => { write.finish(status); await request.mock.results[0].value.catch(() => {}); });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});
