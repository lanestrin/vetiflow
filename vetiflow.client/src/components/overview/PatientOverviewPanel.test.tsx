import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { buildCaseDetail } from "../../test/builders";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail, CaseTask } from "../../types/CaseDetail";
import { PatientOverviewPanel } from "./PatientOverviewPanel";

afterEach(() => {
  sessionStorage.clear();
});

const today = new Date();
const at = (hour: number, minute: number) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute).toISOString();

function buildTask(overrides: Partial<CaseTask>): CaseTask {
  return {
    id: crypto.randomUUID(),
    type: "task",
    description: "A task",
    status: "open",
    dueAt: null,
    assignedTo: null,
    createdAt: at(10, 0),
    resolvedAt: null,
    ...overrides
  };
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
        id: "v2", heartRate: 148, respiratoryRate: 48, temperatureF: 102, mucousMembraneColor: null,
        capillaryRefillTime: null, mentation: null, recordedAt: at(10, 50), recordedBy: null
      },
      {
        id: "v1", heartRate: 160, respiratoryRate: 60, temperatureF: 103, mucousMembraneColor: null,
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
      buildTask({ description: "Place IV catheter", status: "done", assignedTo: { id: "s1", name: "Jordan Reed" } }),
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

function renderPanel(caseId: string | null, refreshedAt = new Date(2026, 0, 1)) {
  const panel = (id: string | null, refreshed: Date) => (
    <MemoryRouter initialEntries={["/er"]}>
      <Routes>
        <Route path="/er" element={<PatientOverviewPanel caseId={id} refreshedAt={refreshed} />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
        <Route path="/pet-parent" element={<p>Pet parent home</p>} />
      </Routes>
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

  it("shows the newest vitals in tiles, with SpO₂ not recorded yet", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    const tiles = within(await screen.findByLabelText("Latest vitals"));
    expect(tiles.getAllByRole("term").map((term) => term.textContent)).toEqual(["Heart rate", "Resp rate", "Temp", "SpO₂"]);
    expect(tiles.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "148 bpm", "48 /min", "38.9 °C", "Not recorded"
    ]);
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
    expect(within(items[0]).getByRole("img", { name: "Open" })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent("Review radiographsPending");
    expect(within(items[1]).getByRole("img", { name: "Done" })).toHaveTextContent("✓");
    expect(items[1]).toHaveTextContent("Place IV catheterJordan Reed");
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
    for (const name of ["More actions", "Call", "Message", "＋ Add task", "Handoff", "Update status"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("marks an incoming case's priority as provisional", async () => {
    serveCase(buildMilo({ stage: "incoming", acuity: "urgent" }));

    renderPanel("case-milo");

    expect(await screen.findByText("Urgent · provisional")).toBeInTheDocument();
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
});
