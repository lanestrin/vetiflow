import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail } from "../../types/CaseDetail";
import { TriageDialog } from "./TriageDialog";

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
  const base = buildCaseDetail({ id: "case-toby", caseNumber: "ER-2489", stage: "incoming", acuity: "urgent" });
  return { ...base, patient: { ...base.patient, name: "Toby" }, ...overrides };
}

function renderDialog(detail: CaseDetail) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<TriageDialog detail={detail} onClose={onClose} onSaved={onSaved} />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { onClose, onSaved };
}

function serveTriage(status: number, body?: unknown) {
  const sent: unknown[] = [];
  server.use(
    http.post(apiUrl("/api/cases/case-toby/triage"), async ({ request }) => {
      sent.push(await request.json());
      return body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
    })
  );
  return sent;
}

describe("TriageDialog", () => {
  it("completes triage on an incoming case, preset to its provisional priority", async () => {
    const sent = serveTriage(204);
    const { onSaved } = renderDialog(buildToby());

    expect(screen.getByRole("dialog", { name: "Complete triage" })).toBeInTheDocument();
    expect(screen.getByText("Toby · Case ER-2489")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Urgent" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Critical" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Complete triage" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Toby triage completed"));
    expect(sent).toEqual([{ priority: "urgent", notes: null }]);
  });

  it("re-triages a later case with a changed priority and notes", async () => {
    const sent = serveTriage(204);
    const { onSaved } = renderDialog(buildToby({ stage: "treatment", acuity: "stable" }));

    expect(screen.getByRole("dialog", { name: "Re-triage" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Critical" }));
    fireEvent.change(screen.getByLabelText("Triage notes"), { target: { value: "  Collapsed in kennel  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save priority" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Toby re-triaged · Critical"));
    expect(sent).toEqual([{ priority: "critical", notes: "Collapsed in kennel" }]);
  });

  it("asks for a priority when the case has none", () => {
    const sent = serveTriage(204);
    renderDialog(buildToby({ acuity: null }));

    fireEvent.click(screen.getByRole("button", { name: "Complete triage" }));

    expect(screen.getByText("Choose a priority.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Priority" })).toHaveAttribute("aria-invalid", "true");
    expect(sent).toEqual([]);
  });

  it("shows the API's field message and keeps what was typed", async () => {
    serveTriage(400, { status: 400, errors: { Notes: ["Keep notes under 2000 characters."] } });
    renderDialog(buildToby());
    fireEvent.change(screen.getByLabelText("Triage notes"), { target: { value: "Long notes" } });

    fireEvent.click(screen.getByRole("button", { name: "Complete triage" }));

    expect(await screen.findByText("Keep notes under 2000 characters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Triage notes")).toHaveValue("Long notes");
    expect(screen.getByLabelText("Triage notes")).toHaveAttribute("aria-invalid", "true");
  });

  it.each([
    [404, "This case is no longer on the board."],
    [409, "This case has been discharged."],
    [500, "Unable to save triage. Try again."]
  ])("explains a %i in the dialog", async (status, message) => {
    serveTriage(status);
    const { onSaved } = renderDialog(buildToby());

    fireEvent.click(screen.getByRole("button", { name: "Complete triage" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("sends the person to sign in when the session has ended", async () => {
    serveTriage(401);
    renderDialog(buildToby());

    fireEvent.click(screen.getByRole("button", { name: "Complete triage" }));

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("closes on Cancel without saving", () => {
    const sent = serveTriage(204);
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
});
