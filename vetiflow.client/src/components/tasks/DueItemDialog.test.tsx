import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail } from "../../types/CaseDetail";
import { DueItemDialog, type DueItemType } from "./DueItemDialog";

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

// Only the clock is fake, so requests and waits still run. Local times, so
// the labels read the same in any test time zone.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 28, 11, 15));
});

afterEach(() => {
  vi.useRealTimers();
});

function buildToby(): CaseDetail {
  const base = buildCaseDetail({ id: "case-toby", caseNumber: "ER-2489" });
  return { ...base, patient: { ...base.patient, name: "Toby" } };
}

function renderDialog(type: DueItemType = "reassessment") {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route
          path="/er"
          element={<DueItemDialog detail={buildToby()} type={type} onClose={onClose} onSaved={onSaved} />}
        />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { onClose, onSaved };
}

function serveTasks(status: number, body?: unknown) {
  const sent: unknown[] = [];
  server.use(
    http.post(apiUrl("/api/cases/case-toby/tasks"), async ({ request }) => {
      sent.push(await request.json());
      return body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
    })
  );
  return sent;
}

describe("DueItemDialog", () => {
  it("opens on the time, half an hour ahead, with the preview", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Set reassessment" })).toBeInTheDocument();
    expect(screen.getByText("Toby · Case ER-2489")).toBeInTheDocument();
    expect(screen.getByLabelText("Due at *")).toHaveFocus();
    expect(screen.getByLabelText("Due at *")).toHaveValue("11:45");
    expect(screen.getByLabelText("Due at *")).toHaveAccessibleDescription("Due in 30 min");
  });

  it("sets a reassessment with the type's name when the note is blank", async () => {
    const sent = serveTasks(201, { id: "task-9" });
    const { onSaved } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Set reassessment" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Reassessment due 11:45 AM"));
    expect(sent).toEqual([{
      type: "reassessment",
      description: "Reassessment",
      dueAt: new Date(2026, 9, 28, 11, 45).toISOString()
    }]);
  });

  it("sets a client update for tomorrow when the time has passed today", async () => {
    const sent = serveTasks(201, { id: "task-9" });
    const { onSaved } = renderDialog("clientUpdate");

    expect(screen.getByRole("dialog", { name: "Set client update" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Due at *"), { target: { value: "09:00" } });
    expect(screen.getByLabelText("Due at *")).toHaveAccessibleDescription("Due 29 Oct, 9:00 AM");
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "  Call with X-ray results  " } });
    fireEvent.click(screen.getByRole("button", { name: "Set client update" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Client update due 29 Oct, 9:00 AM"));
    expect(sent).toEqual([{
      type: "clientUpdate",
      description: "Call with X-ray results",
      dueAt: new Date(2026, 9, 29, 9, 0).toISOString()
    }]);
  });

  it("asks for a time before sending anything", () => {
    const sent = serveTasks(201, { id: "task-9" });
    renderDialog();

    fireEvent.change(screen.getByLabelText("Due at *"), { target: { value: "" } });
    expect(screen.getByText("No time set")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set reassessment" }));

    expect(screen.getByText("Enter a due time.")).toBeInTheDocument();
    expect(screen.getByLabelText("Due at *")).toHaveAttribute("aria-invalid", "true");
    expect(sent).toEqual([]);
  });

  it("shows the API's due time message under the time", async () => {
    serveTasks(400, { status: 400, errors: { DueAt: ["A reassessment or client update needs a due time."] } });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Set reassessment" }));

    expect(await screen.findByText("A reassessment or client update needs a due time.")).toBeInTheDocument();
    expect(screen.getByLabelText("Due at *")).toHaveAttribute("aria-invalid", "true");
  });

  it.each([
    [409, "This case has been discharged."],
    [500, "Unable to save. Try again."]
  ])("explains a %i in the dialog", async (status, message) => {
    serveTasks(status);
    const { onSaved } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Set reassessment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("closes on Cancel without saving", () => {
    const sent = serveTasks(201, { id: "task-9" });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });
});
