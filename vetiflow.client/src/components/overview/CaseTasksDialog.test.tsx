import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail, buildCaseTask } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseTask } from "../../types/CaseDetail";
import { ToastProvider } from "../shell/Toast";
import { CaseTasksDialog } from "./CaseTasksDialog";

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

function renderDialog(tasks: CaseTask[]) {
  const onTaskSaved = vi.fn();
  const detail = buildCaseDetail({ id: "case-toby", tasks });
  render(
    <MemoryRouter initialEntries={["/er"]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/er"
            element={<CaseTasksDialog detail={detail} triggerRef={createRef()} fallbackRef={createRef()} onClose={vi.fn()} onTaskSaved={onTaskSaved} />}
          />
          <Route path="/sign-in" element={<p>Sign-in page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
  return { onTaskSaved };
}

describe("CaseTasksDialog priority and next care action", () => {
  it("shows each open task's saved priority, with Not prioritized when unset", () => {
    renderDialog([
      buildCaseTask({ id: "task-fluids", description: "Start fluids", priority: "urgent" }),
      buildCaseTask({ id: "task-xray", description: "Review radiographs" })
    ]);

    expect(screen.getByLabelText("Priority for Start fluids")).toHaveValue("urgent");
    expect(screen.getByLabelText("Priority for Review radiographs")).toHaveValue("");
    expect(screen.getAllByRole("option", { name: "Not prioritized" })).toHaveLength(2);
  });

  it("saves a priority change and reloads", async () => {
    let sent: unknown = null;
    server.use(http.post(apiUrl("/api/cases/case-toby/tasks/task-xray/priority"), async ({ request }) => {
      sent = await request.json();
      return new HttpResponse(null, { status: 204 });
    }));
    const { onTaskSaved } = renderDialog([buildCaseTask({ id: "task-xray", description: "Review radiographs" })]);

    fireEvent.change(screen.getByLabelText("Priority for Review radiographs"), { target: { value: "high" } });

    expect(await screen.findByText("Priority updated")).toBeInTheDocument();
    expect(sent).toEqual({ priority: "high" });
    expect(onTaskSaved).toHaveBeenCalledTimes(1);
  });

  it("designates a task as the next care action and reloads", async () => {
    let sent: unknown = null;
    server.use(http.put(apiUrl("/api/cases/case-toby/next-action"), async ({ request }) => {
      sent = await request.json();
      return new HttpResponse(null, { status: 204 });
    }));
    const { onTaskSaved } = renderDialog([buildCaseTask({ id: "task-xray", description: "Review radiographs" })]);

    fireEvent.click(screen.getByRole("button", { name: "Make next care action: Review radiographs" }));

    expect(await screen.findByText("Next care action set")).toBeInTheDocument();
    expect(sent).toEqual({ taskId: "task-xray" });
    expect(onTaskSaved).toHaveBeenCalledTimes(1);
  });

  it("shows the designated task with Clear, which clears it", async () => {
    let sent: unknown = null;
    server.use(http.put(apiUrl("/api/cases/case-toby/next-action"), async ({ request }) => {
      sent = await request.json();
      return new HttpResponse(null, { status: 204 });
    }));
    renderDialog([
      buildCaseTask({ id: "task-fluids", description: "Start fluids", isNextAction: true }),
      buildCaseTask({ id: "task-xray", description: "Review radiographs" })
    ]);

    expect(screen.getByText("Next care action")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Make next care action: Start fluids" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear next care action: Start fluids" }));

    expect(await screen.findByText("Next care action cleared")).toBeInTheDocument();
    expect(sent).toEqual({ taskId: null });
  });

  it("offers no priority or designation on a done task", () => {
    renderDialog([
      buildCaseTask({ id: "task-iv", description: "Place IV catheter", status: "done", priority: "high" })
    ]);

    expect(screen.queryByLabelText("Priority for Place IV catheter")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next care action/ })).not.toBeInTheDocument();
    expect(screen.getByText("Priority: High")).toBeInTheDocument();
  });

  it("shows the server's reason when the change is refused, and reloads", async () => {
    server.use(http.post(apiUrl("/api/cases/case-toby/tasks/task-xray/priority"), () =>
      HttpResponse.json({ title: "This task is closed; its priority can no longer change." }, { status: 409 })));
    const { onTaskSaved } = renderDialog([buildCaseTask({ id: "task-xray", description: "Review radiographs" })]);

    fireEvent.change(screen.getByLabelText("Priority for Review radiographs"), { target: { value: "urgent" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("This task is closed; its priority can no longer change.");
    await waitFor(() => expect(onTaskSaved).toHaveBeenCalledTimes(1));
  });
});
