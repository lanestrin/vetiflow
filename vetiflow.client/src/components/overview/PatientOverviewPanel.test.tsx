import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { buildCaseDetail, buildCaseTask } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail, CaseTask } from "../../types/CaseDetail";
import { ToastProvider } from "../shell/Toast";
import { PatientOverviewPanel } from "./PatientOverviewPanel";

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

afterEach(() => {
  sessionStorage.clear();
});

const today = new Date();
const at = (hour: number, minute: number) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute).toISOString();

function buildTask(overrides: Partial<CaseTask>): CaseTask {
  return buildCaseTask({ createdAt: at(10, 0), ...overrides });
}

function buildMilo(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const base = buildCaseDetail({ id: "case-milo" });
  return {
    ...base,
    caseNumber: "ER-2481",
    patient: { ...base.patient, name: "Milo", species: "Dog", breed: "Golden Retriever", dateOfBirth: "2018-01-01" },
    owner: { id: "owner-1", firstName: "Avery", lastName: "Chen", phone: "312-555-0100", email: "avery@example.test" },
    weightKg: 31.4,
    acuity: "critical",
    arrivalTime: at(10, 42),
    room: { id: "room-1", name: "Oxygen Cage", type: "treatment" },
    vitals: [
      {
        id: "v2", heartRate: 148, respiratoryRate: 48, temperatureF: 102, spO2: null, outOfRange: [], mucousMembraneColor: null,
        capillaryRefillTime: null, mentation: null, recordedAt: at(10, 50), recordedBy: null
      },
      {
        id: "v1", heartRate: 160, respiratoryRate: 60, temperatureF: 103, spO2: null, outOfRange: [], mucousMembraneColor: null,
        capillaryRefillTime: null, mentation: null, recordedAt: at(10, 45), recordedBy: null
      }
    ],
    timeline: [
      { id: "e1", type: "arrived", description: "Respiratory distress", createdAt: at(10, 42), createdBy: null },
      { id: "e2", type: "triaged", description: "Critical", createdAt: at(10, 47), createdBy: { id: "s1", name: "Jordan Reed" } }
    ],
    tasks: [
      buildTask({ description: "Review radiographs" }),
      buildTask({ type: "blocker", description: "Thoracic radiographs", assignedTo: { id: "s2", name: "Sam Cruz" } }),
      buildTask({
        description: "Place IV catheter",
        status: "done",
        assignedTo: { id: "s1", name: "Jordan Reed" },
        resolvedBy: { id: "s1", name: "Jordan Reed" }
      }),
      buildTask({ description: "Cancelled task", status: "cancelled" })
    ],
    ...overrides
  };
}

function serveCase(detail: CaseDetail) {
  let requests = 0;
  server.use(
    http.get(apiUrl(`/api/cases/${detail.id}`), () => {
      requests += 1;
      return HttpResponse.json(detail);
    })
  );
  return () => requests;
}

function renderPanel(
  caseId: string | null,
  refreshedAt = new Date(2026, 0, 1),
  onTriaged = vi.fn(),
  onTaskSaved = vi.fn()
) {
  const panel = (id: string | null, refreshed: Date) => (
    <MemoryRouter initialEntries={["/er"]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/er"
            element={<PatientOverviewPanel caseId={id} refreshedAt={refreshed} onTriaged={onTriaged} onTaskSaved={onTaskSaved} />}
          />
          <Route path="/sign-in" element={<p>Sign-in page</p>} />
          <Route path="/pet-parent" element={<p>Pet parent home</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
  const view = render(panel(caseId, refreshedAt));
  return { rerender: (id: string | null, refreshed: Date) => view.rerender(panel(id, refreshed)) };
}

describe("PatientOverviewPanel", () => {
  it("asks for a selection when no card is selected", () => {
    renderPanel(null);

    expect(screen.getByRole("complementary", { name: "Patient overview" })).toBeInTheDocument();
    expect(screen.getByText("Select a patient on the board to see their overview.")).toBeInTheDocument();
  });

  it("shows the case header, patient, pet parent and location", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    expect(screen.getByText("Loading case…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "Milo" })).toBeInTheDocument();
    expect(screen.getByText(/Case ER-2481/)).toHaveTextContent("Case ER-2481·Checked in 10:42 AM");
    expect(screen.getByText(/^Dog · Golden Retriever · \d+ years · 31.4 kg$/)).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Avery Chen")).toBeInTheDocument();
    expect(screen.queryByText("312-555-0100")).not.toBeInTheDocument();
    expect(screen.getByText("Treatment · Oxygen Cage")).toBeInTheDocument();
  });

  it("shows the newest vitals with SpO₂ and the API's alert text", async () => {
    const milo = buildMilo();
    milo.vitals[0].spO2 = 91;
    milo.vitals[0].outOfRange = ["heartRate", "respiratoryRate", "spO2"];
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByLabelText("Latest vitals"));
    expect(tiles.getAllByRole("term").map((term) => term.textContent)).toEqual(["Heart rate", "Resp rate", "Temp", "SpO₂"]);
    expect(tiles.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "148 bpmOutside range", "48 /minOutside range", "38.9 °C", "91%Outside range"
    ]);
  });

  it("uses the API flags instead of inferring alerts from the values", async () => {
    const milo = buildMilo();
    milo.vitals[0].spO2 = 91;
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByLabelText("Latest vitals"));
    expect(tiles.getByText("148 bpm")).toBeInTheDocument();
    expect(tiles.getByText("91%")).toBeInTheDocument();
    expect(tiles.queryByText("Outside range")).not.toBeInTheDocument();
  });

  it("shows a temperature alert when flagged by the API", async () => {
    const milo = buildMilo();
    milo.vitals[0].outOfRange = ["temperatureF"];
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByLabelText("Latest vitals"));
    expect(tiles.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "148 bpm", "48 /min", "38.9 °COutside range", "Not recorded"
    ]);
  });

  it("neither backfills nor flags missing readings in a partial newest set", async () => {
    const milo = buildMilo();
    milo.vitals[0] = { ...milo.vitals[0], heartRate: null, temperatureF: null, outOfRange: ["heartRate", "spO2"] };
    milo.vitals[1].spO2 = 98;
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByLabelText("Latest vitals"));
    expect(tiles.getAllByText("Not recorded")).toHaveLength(3);
    expect(tiles.queryByText("Outside range")).not.toBeInTheDocument();
    expect(tiles.getByText("48 /min")).toBeInTheDocument();
    expect(tiles.queryByText("160 bpm")).not.toBeInTheDocument();
    expect(tiles.queryByText("98%")).not.toBeInTheDocument();
  });

  it("updates the pain score when the selected case reloads", async () => {
    const milo = buildMilo({ latestPainScore: {
      id: "pain-1", score: 7, notes: "Before treatment", recordedAt: at(10, 50), recordedBy: null
    } });
    serveCase(milo);
    const view = renderPanel("case-milo");
    expect(await screen.findByRole("meter", { name: "Pain score" })).toHaveAttribute("aria-valuenow", "7");

    serveCase({ ...milo, latestPainScore: { ...milo.latestPainScore!, id: "pain-2", score: 0, notes: null } });
    view.rerender("case-milo", new Date(2026, 0, 2));

    await vi.waitFor(() => expect(screen.getByRole("meter", { name: "Pain score" })).toHaveAttribute("aria-valuenow", "0"));
    expect(screen.queryByText("Before treatment")).not.toBeInTheDocument();
  });

  it("does not carry the pain score into another patient's loading or empty state", async () => {
    serveCase(buildMilo({ latestPainScore: {
      id: "pain-1", score: 7, notes: "Before treatment", recordedAt: at(10, 50), recordedBy: null
    } }));
    const view = renderPanel("case-milo");
    await screen.findByRole("meter", { name: "Pain score" });

    view.rerender("case-other", new Date(2026, 0, 2));

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText("Before treatment")).not.toBeInTheDocument();
    const pain = within(await screen.findByRole("region", { name: "Pain score" }));
    expect(pain.getByText("Not recorded")).toBeInTheDocument();
    expect(pain.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("says not recorded for every tile when no vitals exist", async () => {
    serveCase(buildMilo({ vitals: [] }));

    renderPanel("case-milo");

    const tiles = within(await screen.findByLabelText("Latest vitals"));
    expect(tiles.getAllByText("Not recorded")).toHaveLength(4);
  });

  it("lists the timeline with open blockers marked as waiting", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    const timeline = within(await screen.findByRole("region", { name: "Care timeline" }));
    const items = timeline.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Arrived10:42 AMRespiratory distress",
      "Triage completed10:47 AMCritical · Jordan Reed",
      "Thoracic radiographsWaitingOpen blocker · Sam Cruz"
    ]);
  });

  it("lists tasks with done and pending, leaving out cancelled tasks and blockers", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    const actions = within(await screen.findByRole("region", { name: "Next actions" }));
    const items = actions.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("checkbox", { name: "Review radiographs" })).not.toBeChecked();
    expect(items[0]).toHaveTextContent("Review radiographsPending");
    expect(within(items[1]).getByRole("checkbox", { name: "Place IV catheter" })).toBeChecked();
    expect(items[1]).toHaveTextContent("✓Place IV catheterJordan Reed");
  });

  it("shows empty timeline and task messages", async () => {
    serveCase(buildMilo({ timeline: [], tasks: [] }));

    renderPanel("case-milo");

    expect(await screen.findByText("No events yet.")).toBeInTheDocument();
    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
  });

  it("shows the controls later items wire as disabled", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    await screen.findByRole("heading", { name: "Milo" });
    for (const name of ["Call", "Message", "Handoff", "Update status"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("marks an incoming case's priority as provisional", async () => {
    serveCase(buildMilo({ stage: "incoming", acuity: "urgent" }));

    renderPanel("case-milo");

    expect(await screen.findByText("Urgent · provisional")).toBeInTheDocument();
  });

  // Triage (build plan 4.2b).
  it("offers Complete triage only for an incoming case, with ••• disabled", async () => {
    serveCase(buildMilo({ stage: "incoming", acuity: "urgent" }));

    renderPanel("case-milo");

    fireEvent.click(await screen.findByRole("button", { name: "Complete triage" }));
    expect(screen.getByRole("dialog", { name: "Complete triage" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Urgent" })).toBeChecked();
    expect(screen.getByRole("button", { name: "More actions" })).toBeDisabled();
  });

  it("offers Re-triage from ••• once a case is past Incoming", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    const more = await screen.findByRole("button", { name: "More actions" });
    expect(screen.queryByRole("button", { name: "Complete triage" })).not.toBeInTheDocument();
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Re-triage" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Re-triage" }));

    expect(screen.getByRole("dialog", { name: "Re-triage" })).toBeInTheDocument();
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the ••• menu on Escape, back on the button, and on a click outside", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");
    const more = await screen.findByRole("button", { name: "More actions" });

    fireEvent.click(more);
    fireEvent.keyDown(screen.getByRole("button", { name: "Re-triage" }), { key: "Escape" });

    expect(screen.queryByRole("button", { name: "Re-triage" })).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    fireEvent.click(more);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("button", { name: "Re-triage" })).not.toBeInTheDocument();
  });

  it("reports a saved triage and moves focus to the patient", async () => {
    serveCase(buildMilo({ stage: "incoming", acuity: "urgent" }));
    server.use(http.post(apiUrl("/api/cases/case-milo/triage"), () => new HttpResponse(null, { status: 204 })));
    const onTriaged = vi.fn();
    renderPanel("case-milo", new Date(2026, 0, 1), onTriaged);

    fireEvent.click(await screen.findByRole("button", { name: "Complete triage" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Complete triage" }));

    await vi.waitFor(() => expect(onTriaged).toHaveBeenCalledWith("Milo triage completed"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Milo" })).toHaveFocus();
  });

  // Seen in the running app: the dialog stayed mounted after saving and
  // reopened when another case was selected.
  it("closes the triage dialog after saving even without a close event", async () => {
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    serveCase(buildMilo({ stage: "incoming", acuity: "urgent" }));
    server.use(http.post(apiUrl("/api/cases/case-milo/triage"), () => new HttpResponse(null, { status: 204 })));
    const onTriaged = vi.fn();
    const { rerender } = renderPanel("case-milo", new Date(2026, 0, 1), onTriaged);

    fireEvent.click(await screen.findByRole("button", { name: "Complete triage" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Complete triage" }));
    await vi.waitFor(() => expect(onTriaged).toHaveBeenCalled());
    rerender("case-other", new Date(2026, 0, 2));
    await screen.findByText(/Case ER-/);

    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
  });

  it("says when the patient has no pet parent or room", async () => {
    serveCase(buildMilo({ owner: null, room: null }));

    renderPanel("case-milo");

    expect(await screen.findByText("No pet parent recorded")).toBeInTheDocument();
    expect(screen.getByText("No room assigned")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Call" })).not.toBeInTheDocument();
  });

  it("says when the case is no longer on the board", async () => {
    server.use(http.get(apiUrl("/api/cases/case-gone"), () => new HttpResponse(null, { status: 404 })));

    renderPanel("case-gone");

    expect(await screen.findByText("This case is no longer on the board.")).toBeInTheDocument();
  });

  it("offers to try again after a failure", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/api/cases/case-milo"), () =>
        fail ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(buildMilo()))
    );

    renderPanel("case-milo");

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this case.");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Loading case…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Milo" })).toBeInTheDocument();
  });

  it("keeps the case on screen while the board reloads it", async () => {
    const requests = serveCase(buildMilo());
    const { rerender } = renderPanel("case-milo", new Date(2026, 0, 1));
    await screen.findByRole("heading", { name: "Milo" });
    serveCase(buildMilo({ patient: { ...buildMilo().patient, name: "Milo B" } }));

    rerender("case-milo", new Date(2026, 0, 2));

    expect(screen.getByRole("heading", { name: "Milo" })).toBeInTheDocument();
    expect(screen.queryByText("Loading case…")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Milo B" })).toBeInTheDocument();
    expect(requests()).toBe(1);
  });

  it("sends the person to sign in when the session has ended", async () => {
    saveAccessToken("expired");
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status: 401 })));

    renderPanel("case-milo");

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
  });

  it("sends a pet parent to their home", async () => {
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status: 403 })));

    renderPanel("case-milo");

    expect(await screen.findByText("Pet parent home")).toBeInTheDocument();
  });

  // The due rows (build plan 4.4b).
  describe("due rows", () => {
    it("shows when the next reassessment and client update are due", async () => {
      const inEight = new Date(Date.now() + 8.5 * 60_000).toISOString();
      serveCase(buildMilo({
        nextReassessment: { id: "r1", description: "Recheck pain", dueAt: inEight, assignedTo: null },
        nextClientUpdate: null
      }));

      renderPanel("case-milo");

      expect(await screen.findByText("Due in 8 min")).toHaveAttribute("data-overdue", "false");
      expect(screen.getByText("Next reassessment")).toBeInTheDocument();
      expect(screen.getByText("Client update")).toBeInTheDocument();
      expect(screen.getByText("Not scheduled")).toHaveAttribute("data-overdue", "false");
    });

    it("marks an overdue item in words and for colour", async () => {
      const twelveAgo = new Date(Date.now() - 12.5 * 60_000).toISOString();
      serveCase(buildMilo({
        nextClientUpdate: { id: "c1", description: "Call owner", dueAt: twelveAgo, assignedTo: null }
      }));

      renderPanel("case-milo");

      expect(await screen.findByText("Overdue by 12 min")).toHaveAttribute("data-overdue", "true");
    });

    it("offers Set with nothing scheduled and Done once something is", async () => {
      serveCase(buildMilo({
        nextReassessment: { id: "r1", description: "Recheck pain", dueAt: new Date().toISOString(), assignedTo: null },
        nextClientUpdate: null
      }));

      renderPanel("case-milo");

      expect(await screen.findByRole("button", { name: "Mark next reassessment done" })).toHaveTextContent("Done");
      expect(screen.getByRole("button", { name: "Set client update" })).toHaveTextContent("Set");
    });

    it("completes the scheduled item on Done and asks for a reload", async () => {
      serveCase(buildMilo({
        nextClientUpdate: { id: "c1", description: "Call owner", dueAt: new Date().toISOString(), assignedTo: null }
      }));
      const posted: string[] = [];
      server.use(
        http.post(apiUrl("/api/cases/case-milo/tasks/:taskId/complete"), ({ params }) => {
          posted.push(String(params.taskId));
          return new HttpResponse(null, { status: 204 });
        })
      );
      const onTaskSaved = vi.fn();
      renderPanel("case-milo", new Date(2026, 0, 1), vi.fn(), onTaskSaved);

      const done = await screen.findByRole("button", { name: "Mark client update done" });

      fireEvent.click(done);
      // Seen in the running app: a disabled button lost focus while saving.
      expect(done).toBeEnabled();
      expect(done).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(done);

      await vi.waitFor(() => expect(onTaskSaved).toHaveBeenCalledOnce());
      expect(posted).toEqual(["c1"]);
    });

    it("says so when Done fails", async () => {
      serveCase(buildMilo({
        nextClientUpdate: { id: "c1", description: "Call owner", dueAt: new Date().toISOString(), assignedTo: null }
      }));
      server.use(
        http.post(apiUrl("/api/cases/case-milo/tasks/c1/complete"), () => new HttpResponse(null, { status: 500 }))
      );
      renderPanel("case-milo");

      fireEvent.click(await screen.findByRole("button", { name: "Mark client update done" }));

      expect(await screen.findByText("Couldn't update the task. Try again.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark client update done" })).toBeEnabled();
    });

    it("sets a reassessment through its dialog, then reports it", async () => {
      serveCase(buildMilo({ nextReassessment: null }));
      server.use(http.post(apiUrl("/api/cases/case-milo/tasks"), () => HttpResponse.json({ id: "r2" }, { status: 201 })));
      const onTaskSaved = vi.fn();
      renderPanel("case-milo", new Date(2026, 0, 1), vi.fn(), onTaskSaved);

      fireEvent.click(await screen.findByRole("button", { name: "Set next reassessment" }));
      const dialog = screen.getByRole("dialog", { name: "Set reassessment" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Set reassessment" }));

      expect(await screen.findByText(/^Reassessment due /)).toBeInTheDocument();
      expect(onTaskSaved).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // Adding tasks and blockers (build plan 4.4c).
  describe("add task", () => {
    it("adds a task through the dialog, then reports it", async () => {
      serveCase(buildMilo());
      const sent: unknown[] = [];
      server.use(
        http.post(apiUrl("/api/cases/case-milo/tasks"), async ({ request }) => {
          sent.push(await request.json());
          return HttpResponse.json({ id: "t9" }, { status: 201 });
        })
      );
      const onTaskSaved = vi.fn();
      renderPanel("case-milo", new Date(2026, 0, 1), vi.fn(), onTaskSaved);

      fireEvent.click(await screen.findByRole("button", { name: "＋ Add task" }));
      const dialog = screen.getByRole("dialog", { name: "Add task" });
      fireEvent.change(within(dialog).getByLabelText("Task *"), { target: { value: "Recheck glucose" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Add task" }));

      expect(await screen.findByText("Task added")).toBeInTheDocument();
      expect(onTaskSaved).toHaveBeenCalledOnce();
      expect(sent).toEqual([{ type: "task", description: "Recheck glucose" }]);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes an open dialog when another case is selected", async () => {
      serveCase(buildMilo());
      const { rerender } = renderPanel("case-milo");

      fireEvent.click(await screen.findByRole("button", { name: "＋ Add task" }));
      expect(screen.getByRole("dialog", { name: "Add task" })).toBeInTheDocument();
      rerender("case-other", new Date(2026, 0, 2));
      await screen.findByText(/Case ER-/);

      expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
    });
  });

  // Ticking tasks done and reopening them (build plan 4.4b).
  describe("checklist ticks", () => {
    function serveAction(action: "complete" | "reopen", status = 204) {
      const posted: string[] = [];
      server.use(
        http.post(apiUrl(`/api/cases/case-milo/tasks/:taskId/${action}`), ({ params }) => {
          posted.push(String(params.taskId));
          return new HttpResponse(null, { status });
        })
      );
      return posted;
    }

    async function checkbox(name: string) {
      return within(await screen.findByRole("region", { name: "Next actions" })).getByRole("checkbox", { name });
    }

    it("completes an open task and asks for a reload", async () => {
      const milo = buildMilo();
      serveCase(milo);
      const posted = serveAction("complete");
      const onTaskSaved = vi.fn();
      renderPanel("case-milo", new Date(2026, 0, 1), vi.fn(), onTaskSaved);
      const box = await checkbox("Review radiographs");

      fireEvent.click(box);

      expect(box).toBeChecked();
      await vi.waitFor(() => expect(onTaskSaved).toHaveBeenCalledOnce());
      expect(posted).toEqual([milo.tasks[0].id]);
    });

    it("reopens a done task", async () => {
      const milo = buildMilo();
      serveCase(milo);
      const posted = serveAction("reopen");
      const onTaskSaved = vi.fn();
      renderPanel("case-milo", new Date(2026, 0, 1), vi.fn(), onTaskSaved);
      const box = await checkbox("Place IV catheter");

      fireEvent.click(box);

      expect(box).not.toBeChecked();
      await vi.waitFor(() => expect(onTaskSaved).toHaveBeenCalledOnce());
      expect(posted).toEqual([milo.tasks[2].id]);
    });

    it("puts the tick back and says so when the save fails", async () => {
      serveCase(buildMilo());
      serveAction("complete", 409);
      const onTaskSaved = vi.fn();
      renderPanel("case-milo", new Date(2026, 0, 1), vi.fn(), onTaskSaved);
      const box = await checkbox("Review radiographs");

      fireEvent.click(box);

      expect(await screen.findByText("Couldn't update the task. Try again.")).toBeInTheDocument();
      expect(box).not.toBeChecked();
      expect(box).toBeEnabled();
      expect(onTaskSaved).toHaveBeenCalledOnce();
    });

    it("sends the person to sign in when the session has ended", async () => {
      saveAccessToken("expired");
      serveCase(buildMilo());
      serveAction("complete", 401);
      renderPanel("case-milo");

      fireEvent.click(await checkbox("Review radiographs"));

      expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
      expect(readAccessToken()).toBeNull();
    });
  });
});
