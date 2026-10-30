import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as casesApi from "../../services/casesApi";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { buildCaseDetail, buildCaseTask, buildPainScore } from "../../test/builders";
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
  onTaskSaved = vi.fn(),
  onVitalsSaved = vi.fn(),
  onPainScoreSaved = vi.fn()
) {
  const panel = (id: string | null, refreshed: Date) => (
    <MemoryRouter initialEntries={["/er"]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/er"
            element={<PatientOverviewPanel caseId={id} refreshedAt={refreshed} onTriaged={onTriaged} onTaskSaved={onTaskSaved} onVitalsSaved={onVitalsSaved} onPainScoreSaved={onPainScoreSaved} />}
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

  it("shows latest observations literally with the set's recorded time and staff", async () => {
    const milo = buildMilo();
    milo.vitals[0] = { ...milo.vitals[0], mucousMembraneColor: "Pink", capillaryRefillTime: "2 s",
      mentation: "<script>Alert</script>", recordedBy: { id: "s1", name: "Jordan Lee" } };
    serveCase(milo);
    renderPanel("case-milo");
    const vitals = within(await screen.findByRole("region", { name: "Vitals" }));
    const observations = within(vitals.getByLabelText("Latest observations"));
    expect(observations.getAllByRole("term").map(term => term.textContent)).toEqual([
      "Mucous membrane colour", "Capillary refill time", "Mentation"
    ]);
    expect(observations.getAllByRole("definition").map(value => value.textContent)).toEqual([
      "Pink", "2 s", "<script>Alert</script>"
    ]);
    expect(vitals.getByText(/^Recorded /)).toHaveTextContent("Recorded 10:50 AM · Jordan Lee");
  });

  it("does not backfill missing latest observations or invent a recorder", async () => {
    const milo = buildMilo();
    milo.vitals[1].mentation = "Older observation";
    serveCase(milo);
    renderPanel("case-milo");
    const vitals = within(await screen.findByRole("region", { name: "Vitals" }));
    expect(within(vitals.getByLabelText("Latest observations")).getAllByText("Not recorded")).toHaveLength(3);
    expect(vitals.getByText(/^Recorded/)).toHaveTextContent(/^Recorded 10:50 AM$/);
    expect(vitals.queryByText("Older observation")).not.toBeInTheDocument();
  });

  it("shows missing observations without recorded metadata when no set exists", async () => {
    serveCase(buildMilo({ vitals: [] }));
    renderPanel("case-milo");
    const vitals = within(await screen.findByRole("region", { name: "Vitals" }));
    expect(within(vitals.getByLabelText("Latest observations")).getAllByText("Not recorded")).toHaveLength(3);
    expect(vitals.queryByText(/^Recorded /)).not.toBeInTheDocument();
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


describe.each(["Clinical", "Timeline"])("%s review in the overview", kind => {
  it("offers review only after a permitted detail loads, including a discharged record", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    const view = renderPanel(null);
    expect(screen.queryByRole("button", { name: kind })).not.toBeInTheDocument();
    view.rerender("case-milo", new Date());
    expect(screen.queryByRole("button", { name: kind })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: kind })).toBeEnabled();
  });

  it("opens from current detail and closes back on the trigger without refetching", async () => {
    const reads = serveCase(buildMilo());
    renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    expect(within(screen.getByRole("dialog", { name: kind })).getByText(kind === "Clinical" ? "148 bpm" : "Respiratory distress")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Close ${kind}` }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: kind })).toHaveFocus());
    expect(reads()).toBe(1);
  });

  it("updates an open review from a same-case refresh without resetting focus", async () => {
    const milo = buildMilo();
    serveCase(milo);
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    const drawer = within(screen.getByRole("dialog"));
    serveCase({ ...milo, vitals: [{ ...milo.vitals[0], heartRate: 95, mentation: "Alert", recordedBy: { id: "fresh-recorder", name: "Fresh Recorder" } }] });
    view.rerender("case-milo", new Date());
    expect(await drawer.findByText(/Fresh Recorder/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Close ${kind}` })).toHaveFocus();
  });

  it("closes on deselection without leaking content", async () => {
    serveCase(buildMilo());
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    view.rerender(null, new Date());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(kind === "Clinical" ? "148 bpm" : "Respiratory distress")).not.toBeInTheDocument();
  });

  it("closes on patient change and ignores the old drawer's late close event", async () => {
    serveCase(buildMilo());
    serveCase(buildCaseDetail({ id: "case-second" }));
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    const oldDrawer = screen.getByRole("dialog");
    view.rerender("case-second", new Date());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    fireEvent(oldDrawer, new Event("close"));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(within(screen.getByRole("dialog")).queryByText(kind === "Clinical" ? "148 bpm" : "Respiratory distress")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Close ${kind}` })).toHaveFocus();
  });

  it("ignores an old patient's late detail refresh after a new review opens", async () => {
    const milo = buildMilo();
    const second = buildCaseDetail({ id: "case-second" });
    serveCase(milo);
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    let finishOld!: (detail: CaseDetail | null) => void;
    const oldReply = new Promise<CaseDetail | null>(resolve => { finishOld = resolve; });
    const loader = vi.spyOn(casesApi, "getCase").mockReturnValueOnce(oldReply).mockResolvedValueOnce(second);
    view.rerender("case-milo", new Date());
    await waitFor(() => expect(loader).toHaveBeenCalledWith("case-milo"));
    view.rerender(second.id, new Date());
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    await act(async () => { finishOld(milo); await oldReply; });
    expect(screen.getByRole("dialog", { name: kind })).toHaveAccessibleDescription(`${second.patient.name} · Case ${second.caseNumber}`);
    expect(within(screen.getByRole("dialog")).queryByText(kind === "Clinical" ? "148 bpm" : "Respiratory distress")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Close ${kind}` })).toHaveFocus();
  });

  it.each([404, 500])("closes after refetch %s, uses heading focus and stays closed after recovery", async status => {
    const milo = buildMilo();
    serveCase(milo);
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status })));
    view.rerender("case-milo", new Date());
    await screen.findByText(status === 404 ? "This case is no longer on the board." : "Unable to load this case.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: kind })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Patient overview" })).toHaveFocus());
    serveCase(milo);
    if (status === 500) fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    else view.rerender("case-milo", new Date());
    await screen.findByRole("button", { name: kind });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([[401, "Sign-in page"], [403, "Pet parent home"]])("clears private review on refusal %s", async (status, destination) => {
    serveCase(buildMilo());
    saveAccessToken("demo-session");
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: kind }));
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status: Number(status) })));
    view.rerender("case-milo", new Date());
    await screen.findByText(destination);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(kind === "Clinical" ? "148 bpm" : "Respiratory distress")).not.toBeInTheDocument();
  });
});

describe("switching encounter review views", () => {
  it("keeps one view open and ignores a departed view's delayed close", async () => {
    const reads = serveCase(buildMilo());
    renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: "Clinical" }));
    const oldClinical = screen.getByRole("dialog", { name: "Clinical" });
    fireEvent.click(screen.getByRole("button", { name: "Close Clinical" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Clinical" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    const oldTimeline = screen.getByRole("dialog", { name: "Timeline" });
    fireEvent(oldClinical, new Event("close"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Timeline" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close Timeline" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Close Timeline" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Timeline" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Clinical" }));
    fireEvent(oldTimeline, new Event("close"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Clinical" })).toBeVisible();
    expect(reads()).toBe(1);
    expect(screen.getByRole("region", { name: "Care timeline" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Next actions" })).toBeInTheDocument();
  });
});

describe("recording vitals in the overview", () => {
  it("offers entry only after an active case loads", async () => {
    serveCase(buildMilo());
    const view = renderPanel(null);
    expect(screen.queryByRole("button", { name: "Record vitals" })).not.toBeInTheDocument();
    view.rerender("case-milo", new Date());
    expect(screen.queryByRole("button", { name: "Record vitals" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Record vitals" })).toBeEnabled();
  });

  it.each([404, 500])("offers no entry after detail failure %s", async status => {
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status })));
    renderPanel("case-milo");
    await screen.findByText(status === 404 ? "This case is no longer on the board." : "Unable to load this case.");
    expect(screen.queryByRole("button", { name: "Record vitals" })).not.toBeInTheDocument();
  });

  it("disables entry for a known discharged case", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    renderPanel("case-milo");
    expect(await screen.findByRole("button", { name: "Record vitals" })).toBeDisabled();
  });

  it("discards a cancelled draft, restores focus and reopens the latest saved values", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");
    const action = await screen.findByRole("button", { name: "Record vitals" });
    action.focus();
    fireEvent.click(action);
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).toHaveFocus();
    fireEvent.click(action);
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("148");
  });

  it("retains the opening set during a background update and prefills the new set only on reopening", async () => {
    const milo = buildMilo();
    serveCase(milo);
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    serveCase({ ...milo, vitals: [{ ...milo.vitals[0], heartRate: 120, temperatureF: 80, mentation: "Updated" }] });
    view.rerender("case-milo", new Date());
    await screen.findByText("120 bpm");
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("90");
    expect(screen.getByLabelText("Temperature (°C)")).toHaveValue("38.9");
    expect(screen.getByLabelText("Mentation")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Record vitals" }));
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("120");
    expect(screen.getByLabelText("Temperature (°C)")).toHaveValue("26.7");
    expect(screen.getByLabelText("Mentation")).toHaveValue("Updated");
  });

  it.each([200, 500])("preserves a draft across a same-case refresh returning %s", async status => {
    serveCase(buildMilo());
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "91" } });
    let requests = 0;
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => {
      requests++;
      return status === 200 ? HttpResponse.json(buildMilo({ weightKg: 32 })) : new HttpResponse(null, { status });
    }));
    view.rerender("case-milo", new Date());
    await waitFor(() => expect(requests).toBe(1));
    if (status === 200) await screen.findByText(/32 kg/);
    else await screen.findByText("Unable to load this case.");
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("91");
    expect(screen.getByRole("dialog")).toHaveTextContent("Milo");
  });

  it("clears the form on a case switch and does not carry readings to the next patient", async () => {
    serveCase(buildMilo());
    const second = buildCaseDetail({ id: "case-second" });
    serveCase(second);
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    view.rerender(second.id, new Date());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(second.caseNumber);
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("");
  });

  it("does not close another patient's form or show a stale toast when an earlier save completes", async () => {
    serveCase(buildMilo());
    serveCase(buildCaseDetail({ id: "case-second" }));
    let finish!: () => void;
    const response = new Promise<void>(resolve => { finish = resolve; });
    server.use(http.post(apiUrl("/api/cases/case-milo/vitals"), async () => {
      await response;
      return new HttpResponse(null, { status: 201 });
    }));
    const write = vi.spyOn(casesApi, "recordVitals");
    const onSaved = vi.fn();
    const view = renderPanel("case-milo", new Date(), vi.fn(), vi.fn(), onSaved);
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
    expect(write).toHaveBeenCalledWith("case-milo", { heartRate: 90, respiratoryRate: 48, temperatureF: 102 });
    view.rerender("case-second", new Date());
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "100" } });
    await act(async () => { finish(); await write.mock.results[0].value; });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("100");
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByText("Vitals recorded")).not.toBeInTheDocument();
  });

  it("refreshes the displayed set and announces success after saving", async () => {
    const milo = buildMilo();
    serveCase(milo);
    server.use(http.post(apiUrl("/api/cases/case-milo/vitals"), () => {
      serveCase({ ...milo, vitals: [{ ...milo.vitals[0], heartRate: 95, spO2: 98 }] });
      return new HttpResponse(null, { status: 201 });
    }));
    const onSaved = vi.fn();
    renderPanel("case-milo", new Date(), vi.fn(), vi.fn(), onSaved);
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "95" } });
    fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
    expect(await screen.findByText("95 bpm")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Vitals recorded");
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record vitals" })).toHaveFocus();
  });

  it("requests a refresh without success when a case becomes unavailable", async () => {
    const milo = buildMilo();
    serveCase(milo);
    server.use(http.post(apiUrl("/api/cases/case-milo/vitals"), () => {
      serveCase({ ...milo, dischargedAt: at(12, 0) });
      return new HttpResponse(null, { status: 409 });
    }));
    const onRefresh = vi.fn();
    renderPanel("case-milo", new Date(), vi.fn(), vi.fn(), onRefresh);
    fireEvent.click(await screen.findByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This case has been discharged.");
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Save vitals" })).toBeDisabled();
    expect(screen.queryByText("Vitals recorded")).not.toBeInTheDocument();
  });
});


describe("recording pain assessments in the overview", () => {
  it("offers recording after a loaded active case, including one with no prior score", async () => {
    serveCase(buildMilo({ latestPainScore: null }));
    const view = renderPanel(null);
    expect(screen.queryByRole("button", { name: "Record score" })).not.toBeInTheDocument();
    view.rerender("case-milo", new Date());
    expect(screen.queryByRole("button", { name: "Record score" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Record score" })).toBeEnabled();
  });

  it.each([404, 500])("does not offer pain entry after load failure %s", async status => {
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status })));
    renderPanel("case-milo");
    await screen.findByText(status === 404 ? "This case is no longer on the board." : "Unable to load this case.");
    expect(screen.queryByRole("button", { name: "Record score" })).not.toBeInTheDocument();
  });

  it("disables pain entry for a known discharged case", async () => {
    serveCase(buildMilo({ dischargedAt: at(12, 0) }));
    renderPanel("case-milo");
    expect(await screen.findByRole("button", { name: "Record score" })).toBeDisabled();
  });

  it("discards a cancelled assessment and returns focus without preselecting an old score", async () => {
    serveCase(buildMilo({ latestPainScore: buildPainScore({ score: 7, notes: "Previous note" }) }));
    renderPanel("case-milo");
    const action = await screen.findByRole("button", { name: "Record score" });
    action.focus();
    fireEvent.click(action);
    expect(screen.getByLabelText("Pain score (0 to 10)")).toHaveValue("");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Pain score (0 to 10)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(action);
    expect(screen.getByLabelText("Pain score (0 to 10)")).toHaveValue("");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("");
  });

  it.each([200, 500])("preserves both draft fields across same-case refresh %s", async status => {
    serveCase(buildMilo());
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: "Record score" }));
    fireEvent.change(screen.getByLabelText("Pain score (0 to 10)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Current draft" } });
    let reads = 0;
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => {
      reads++;
      return status === 200 ? HttpResponse.json(buildMilo({ weightKg: 32 })) : new HttpResponse(null, { status });
    }));
    view.rerender("case-milo", new Date());
    await waitFor(() => expect(reads).toBe(1));
    if (status === 200) await screen.findByText(/32 kg/);
    else await screen.findByText("Unable to load this case.");
    expect(screen.getByLabelText("Pain score (0 to 10)")).toHaveValue("0");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Current draft");
  });

  it("clears the assessment when switching cases", async () => {
    serveCase(buildMilo());
    const second = buildCaseDetail({ id: "case-second" });
    serveCase(second);
    const view = renderPanel("case-milo");
    fireEvent.click(await screen.findByRole("button", { name: "Record score" }));
    fireEvent.change(screen.getByLabelText("Pain score (0 to 10)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Old draft" } });
    view.rerender(second.id, new Date());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Record score" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(second.caseNumber);
    expect(screen.getByLabelText("Pain score (0 to 10)")).toHaveValue("");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("");
  });

  it("ignores a previous patient's late save while a new patient's form is open", async () => {
    serveCase(buildMilo());
    serveCase(buildCaseDetail({ id: "case-second" }));
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    server.use(http.post(apiUrl("/api/cases/case-milo/pain-scores"), async () => {
      await pending;
      return new HttpResponse(null, { status: 201 });
    }));
    const request = vi.spyOn(casesApi, "recordPainScore");
    const onSaved = vi.fn();
    const view = renderPanel("case-milo", new Date(), vi.fn(), vi.fn(), vi.fn(), onSaved);
    fireEvent.click(await screen.findByRole("button", { name: "Record score" }));
    fireEvent.change(screen.getByLabelText("Pain score (0 to 10)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save pain score" }));
    expect(request).toHaveBeenCalledWith("case-milo", { score: 3 });
    view.rerender("case-second", new Date());
    fireEvent.click(await screen.findByRole("button", { name: "Record score" }));
    fireEvent.change(screen.getByLabelText("Pain score (0 to 10)"), { target: { value: "8" } });
    await act(async () => { finish(); await request.mock.results[0].value; });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByLabelText("Pain score (0 to 10)")).toHaveValue("8");
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByText("Pain score recorded")).not.toBeInTheDocument();
  });

  it("reads back score zero, notes and recorder metadata without losing the focus target", async () => {
    const milo = buildMilo();
    serveCase(milo);
    server.use(http.post(apiUrl("/api/cases/case-milo/pain-scores"), () => {
      serveCase({ ...milo, latestPainScore: buildPainScore({
        score: 0, notes: "Brief demo note", recordedAt: at(10, 56), recordedBy: { id: "staff-ortiz", name: "Sam Ortiz" }
      }) });
      return new HttpResponse(null, { status: 201 });
    }));
    const onSaved = vi.fn();
    renderPanel("case-milo", new Date(), vi.fn(), vi.fn(), vi.fn(), onSaved);
    fireEvent.click(await screen.findByRole("button", { name: "Record score" }));
    fireEvent.change(screen.getByLabelText("Pain score (0 to 10)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Brief demo note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save pain score" }));
    expect(await screen.findByText("0 / 10")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Brief demo note")).toBeInTheDocument();
    expect(screen.getByText(/Recorded.*Sam Ortiz/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Pain score recorded");
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record score" })).toHaveFocus();
    expect(screen.getByText("148 bpm")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("refreshes an unavailable case without a success toast or another save", async () => {
    const milo = buildMilo();
    serveCase(milo);
    server.use(http.post(apiUrl("/api/cases/case-milo/pain-scores"), () => {
      serveCase({ ...milo, dischargedAt: at(12, 0) });
      return new HttpResponse(null, { status: 409 });
    }));
    const onRefresh = vi.fn();
    renderPanel("case-milo", new Date(), vi.fn(), vi.fn(), vi.fn(), onRefresh);
    fireEvent.click(await screen.findByRole("button", { name: "Record score" }));
    fireEvent.change(screen.getByLabelText("Pain score (0 to 10)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save pain score" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This case has been discharged.");
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Save pain score" })).toBeDisabled();
    expect(screen.queryByText("Pain score recorded")).not.toBeInTheDocument();
  });
});
