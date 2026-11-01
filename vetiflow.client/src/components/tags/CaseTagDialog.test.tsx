import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail } from "../../types/CaseDetail";
import { CaseTagDialog } from "./CaseTagDialog";

// jsdom has no modal dialogs; these behave like the browser's for the test.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

function buildToby(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const base = buildCaseDetail({ id: "case-toby", caseNumber: "ER-2489", dischargedAt: null });
  return { ...base, patient: { ...base.patient, name: "Toby" }, ...overrides };
}

function renderDialog(detail: CaseDetail) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<CaseTagDialog detail={detail} onClose={onClose} onSaved={onSaved} />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { onClose, onSaved };
}

function serveTag(status: number, body?: unknown) {
  const sent: unknown[] = [];
  server.use(
    http.post(apiUrl("/api/cases/case-toby/tags"), async ({ request }) => {
      sent.push(await request.json());
      return body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
    })
  );
  return sent;
}

describe("CaseTagDialog", () => {
  it("opens with an empty text field and the neutral tone chosen", () => {
    renderDialog(buildToby());

    expect(screen.getByRole("dialog", { name: "Add tag" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tag text")).toHaveValue("");
    expect(screen.getByLabelText("Tone")).toHaveValue("neutral");
    expect(screen.getByLabelText("Tag text")).toHaveFocus();
  });

  it("saves the trimmed text and chosen tone, then reports the tag as added", async () => {
    const sent = serveTag(201, { id: "tag-1", text: "O2 support", tone: "caution", createdAt: "2026-11-01T10:00:00Z", createdBy: null });
    const { onSaved } = renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Tag text"), { target: { value: "  O2 support  " } });
    fireEvent.change(screen.getByLabelText("Tone"), { target: { value: "caution" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Tag added"));
    expect(sent).toEqual([{ text: "O2 support", tone: "caution" }]);
  });

  it("asks for text before sending when the field is blank", () => {
    const sent = serveTag(201);
    renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Tag text"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    expect(screen.getByText("Enter the tag's text.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tag text")).toHaveAttribute("aria-invalid", "true");
    expect(sent).toEqual([]);
  });

  it("shows the server's field message under the field and keeps what was typed", async () => {
    serveTag(400, { status: 400, errors: { Text: ["Use 40 characters or fewer."] } });
    renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Tag text"), { target: { value: "Too long" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    expect(await screen.findByText("Use 40 characters or fewer.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tag text")).toHaveValue("Too long");
  });

  it("shows the server's reason for a refused add and keeps what was typed", async () => {
    serveTag(409, { title: "This case already has 5 tags.", status: 409 });
    const { onSaved } = renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Tag text"), { target: { value: "Sixth" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This case already has 5 tags.");
    expect(screen.getByLabelText("Tag text")).toHaveValue("Sixth");
    expect(screen.getByRole("dialog", { name: "Add tag" })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with a neutral message when the save fails", async () => {
    serveTag(500);
    renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Tag text"), { target: { value: "Keep this" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to add the tag. Try again.");
    expect(screen.getByLabelText("Tag text")).toHaveValue("Keep this");
    expect(screen.getByRole("button", { name: "Add tag" })).toBeEnabled();
  });

  it("cannot save a discharged case", () => {
    renderDialog(buildToby({ dischargedAt: "2026-11-01T10:00:00Z" }));

    expect(screen.getByRole("alert")).toHaveTextContent("This case is no longer available for changes.");
    expect(screen.getByRole("button", { name: "Add tag" })).toBeDisabled();
  });

  it("closes on Cancel without saving", () => {
    const sent = serveTag(201);
    const { onClose } = renderDialog(buildToby());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });

  it("closes when the dialog is cancelled with Escape", () => {
    const { onClose } = renderDialog(buildToby());
    const dialog = screen.getByRole<HTMLDialogElement>("dialog");

    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends the person to sign in when the session has ended", async () => {
    serveTag(401);
    renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Tag text"), { target: { value: "O2 support" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });
});
