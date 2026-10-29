import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail } from "../../types/CaseDetail";
import { AddTaskDialog } from "./AddTaskDialog";

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

function buildToby(): CaseDetail {
  const base = buildCaseDetail({ id: "case-toby", caseNumber: "ER-2489" });
  return { ...base, patient: { ...base.patient, name: "Toby" } };
}

function renderDialog() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<AddTaskDialog detail={buildToby()} onClose={onClose} onSaved={onSaved} />} />
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

function serveClinicians() {
  server.use(
    http.get(apiUrl("/api/staff/on-floor"), () => HttpResponse.json([
      { id: "staff-lee", displayName: "Dr. Jordan Lee", initials: "JL", role: "veterinarian", status: "busy", activeCaseCount: 2 },
      { id: "staff-ortiz", displayName: "Sam Ortiz", initials: "SO", role: "technician", status: "available", activeCaseCount: 1 }
    ]))
  );
}

describe("AddTaskDialog", () => {
  it("opens on the task field for this case, as a task, unassigned", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Add task" })).toBeInTheDocument();
    expect(screen.getByText("Toby · Case ER-2489")).toBeInTheDocument();
    expect(screen.getByLabelText("Task *")).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Task" })).toBeChecked();
    expect(screen.getByLabelText("Assign to")).toHaveValue("");
  });

  it("adds a blocker assigned to a clinician on the floor", async () => {
    serveClinicians();
    const sent = serveTasks(201, { id: "task-9" });
    const { onSaved } = renderDialog();

    await screen.findByRole("option", { name: "Sam Ortiz" });
    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "  Awaiting owner consent  " } });
    fireEvent.click(screen.getByRole("radio", { name: "Blocker" }));
    fireEvent.change(screen.getByLabelText("Assign to"), { target: { value: "staff-ortiz" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Blocker added"));
    expect(sent).toEqual([{ type: "blocker", description: "Awaiting owner consent", assignedToStaffId: "staff-ortiz" }]);
  });

  it("adds an unassigned task without an assignee", async () => {
    const sent = serveTasks(201, { id: "task-9" });
    const { onSaved } = renderDialog();

    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "Review radiographs" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Task added"));
    expect(sent).toEqual([{ type: "task", description: "Review radiographs" }]);
  });

  it("asks for a task before sending anything", () => {
    const sent = serveTasks(201, { id: "task-9" });
    renderDialog();

    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByText("Enter a task.")).toBeInTheDocument();
    expect(screen.getByLabelText("Task *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Task *")).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it("shows the API's field message and keeps what was typed", async () => {
    serveTasks(400, { status: 400, errors: { Description: ["Keep the task under 200 characters."] } });
    renderDialog();
    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "Long task" } });

    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Keep the task under 200 characters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Task *")).toHaveValue("Long task");
    expect(screen.getByLabelText("Task *")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a refused assignee under Assign to", async () => {
    serveClinicians();
    serveTasks(400, { status: 400, errors: { AssignedToStaffId: ["No active staff member has this ID."] } });
    renderDialog();
    await screen.findByRole("option", { name: "Dr. Jordan Lee" });
    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "Review radiographs" } });
    fireEvent.change(screen.getByLabelText("Assign to"), { target: { value: "staff-lee" } });

    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("No active staff member has this ID.")).toBeInTheDocument();
    expect(screen.getByLabelText("Assign to")).toHaveAttribute("aria-invalid", "true");
  });

  it.each([
    [404, "This case is no longer on the board."],
    [409, "This case has been discharged."],
    [500, "Unable to save. Try again."]
  ])("explains a %i in the dialog", async (status, message) => {
    serveTasks(status);
    const { onSaved } = renderDialog();
    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "Review radiographs" } });

    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("still adds an unassigned task when the clinicians can't be loaded", async () => {
    server.use(http.get(apiUrl("/api/staff/on-floor"), () => new HttpResponse(null, { status: 500 })));
    const sent = serveTasks(201, { id: "task-9" });
    const { onSaved } = renderDialog();

    expect(await screen.findByText("Couldn't load who's on the floor. You can still add it unassigned.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "Review radiographs" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("Task added"));
    expect(sent).toEqual([{ type: "task", description: "Review radiographs" }]);
  });

  it("sends the person to sign in when the session has ended", async () => {
    serveTasks(401);
    renderDialog();
    fireEvent.change(screen.getByLabelText("Task *"), { target: { value: "Review radiographs" } });

    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("closes on Cancel without saving", () => {
    const sent = serveTasks(201, { id: "task-9" });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });
});
