import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail } from "../../types/CaseDetail";
import { UpdateStatusDialog } from "./UpdateStatusDialog";

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
  const base = buildCaseDetail({
    id: "case-toby",
    caseNumber: "ER-2489",
    stage: "triage",
    status: "unassigned",
    nextAction: "Recheck pain",
    dischargedAt: null
  });
  return { ...base, patient: { ...base.patient, name: "Toby" }, ...overrides };
}

function renderDialog(detail: CaseDetail) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<UpdateStatusDialog detail={detail} onClose={onClose} onSaved={onSaved} />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { onClose, onSaved };
}

function serveStatus(status: number, body?: unknown) {
  const sent: unknown[] = [];
  server.use(
    http.patch(apiUrl("/api/cases/case-toby/status"), async ({ request }) => {
      sent.push(await request.json());
      return body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
    })
  );
  return sent;
}

describe("UpdateStatusDialog", () => {
  it("is pre-filled with the case's current stage, status and next action", () => {
    renderDialog(buildToby());

    expect(screen.getByRole("dialog", { name: "Update status" })).toBeInTheDocument();
    expect(screen.getByText("Toby · Case ER-2489")).toBeInTheDocument();
    expect(screen.getByLabelText("Stage")).toHaveValue("triage");
    expect(screen.getByLabelText("Status")).toHaveValue("unassigned");
    expect(screen.getByLabelText("Next action")).toHaveValue("Recheck pain");
  });

  it("saves the chosen stage, status and next action, then reports the change", async () => {
    const sent = serveStatus(204);
    const { onSaved } = renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "treatment" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "inProgress" } });
    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "  Start fluids  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Status updated"));
    expect(sent).toEqual([{ stage: "treatment", status: "inProgress", nextAction: "Start fluids" }]);
  });

  it("sends a null next action when it is left blank", async () => {
    const sent = serveStatus(204);
    const { onSaved } = renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent).toEqual([{ stage: "triage", status: "unassigned", nextAction: null }]);
  });

  it("shows the server's refusal reason and keeps what was typed", async () => {
    serveStatus(409, { title: "A case in Treatment cannot move to Triage.", status: 409 });
    const { onSaved } = renderDialog(buildToby({ stage: "treatment" }));

    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "triage" } });
    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "Keep this note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A case in Treatment cannot move to Triage.");
    expect(screen.getByLabelText("Next action")).toHaveValue("Keep this note");
    expect(screen.getByRole("dialog", { name: "Update status" })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with a neutral message when the save fails", async () => {
    serveStatus(500);
    renderDialog(buildToby());

    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "Keep this too" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update status. Try again.");
    expect(screen.getByLabelText("Next action")).toHaveValue("Keep this too");
    expect(screen.getByRole("button", { name: "Save status" })).toBeEnabled();
  });

  it("tells the person when the case has been discharged and cannot be saved", () => {
    renderDialog(buildToby({ dischargedAt: "2026-11-01T10:00:00Z", stage: "discharge" }));

    expect(screen.getByRole("alert")).toHaveTextContent("This case is no longer available for changes.");
    expect(screen.getByRole("button", { name: "Save status" })).toBeDisabled();
    expect(screen.getByLabelText("Stage")).toBeDisabled();
  });

  it("closes on Cancel without saving", () => {
    const sent = serveStatus(204);
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
    serveStatus(401);
    renderDialog(buildToby());

    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });
});
