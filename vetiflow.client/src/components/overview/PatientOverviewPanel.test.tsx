import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as casesApi from "../../services/casesApi";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readAccessToken, saveAccessToken } from "../../services/session";
import { buildCaseDetail, buildCaseTask, buildTeamMember } from "../../test/builders";
import type { SignedInUser } from "../../types/Auth";
import { apiUrl, server } from "../../test/server";
import type { CaseDetail, CaseTask } from "../../types/CaseDetail";
import type { PatientProfileRouteState } from "../../routes/PatientProfilePage";
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

// Who is signed in for renderPanel; a test may change it before rendering.
let signedInUser: SignedInUser = buildTeamMember();

afterEach(() => {
  signedInUser = buildTeamMember();
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
        capillaryRefillTime: null, mentation: null, occurredAt: null, recordedAt: at(10, 50), recordedBy: null
      },
      {
        id: "v1", heartRate: 160, respiratoryRate: 60, temperatureF: 103, spO2: null, outOfRange: [], mucousMembraneColor: null,
        capillaryRefillTime: null, mentation: null, occurredAt: null, recordedAt: at(10, 45), recordedBy: null
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

// Stands in for the patient profile and shows what the link sent.
function ProfileStub() {
  const { patientId } = useParams();
  const state = useLocation().state as PatientProfileRouteState | null;
  return <p>Profile of {patientId} from case {state?.fromErBoard?.caseId ?? "none"}</p>;
}

function renderPanel(
  caseId: string | null,
  refreshedAt = new Date(2026, 0, 1),
  onTriaged = vi.fn(),
  onTaskSaved = vi.fn(),
  onVitalsSaved = vi.fn(),
  onClose = vi.fn()
) {
  const panel = (id: string | null, refreshed: Date) => (
    <MemoryRouter initialEntries={["/er"]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/er"
            element={<PatientOverviewPanel caseId={id} signedInUser={signedInUser} refreshedAt={refreshed} onTriaged={onTriaged} onTaskSaved={onTaskSaved} onVitalsSaved={onVitalsSaved} onClose={onClose} />}
          />
          <Route path="/records/:patientId" element={<ProfileStub />} />
          <Route path="/sign-in" element={<p>Sign-in page</p>} />
          <Route path="/pet-parent" element={<p>Pet parent home</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
  const view = render(panel(caseId, refreshedAt));
  return { rerender: (id: string | null, refreshed: Date) => view.rerender(panel(id, refreshed)) };
}

// Opens a patient record tab and returns its panel (build plan 3.2c).
async function openTab(name: string) {
  fireEvent.click(await screen.findByRole("tab", { name }));
  return screen.getByRole("tabpanel", { name });
}

async function openMoreAction(label: string) {
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  // Record vitals is also a button in the Overview's vitals section (3.2d).
  fireEvent.click(within(await screen.findByRole("list", { name: "More actions" })).getByRole("button", { name: label }));
}

it.each([
  ["Re-triage", "Triage notes", "Save priority"],
  ["Add task", "Task *", "Add task"],
  ["Set reassessment", "Note", "Set reassessment"],
  ["Record vitals", "Mentation", "Save vitals"]
])("retains %s through same-case refresh, a failed load and a missing encounter", async (action, field, save) => {
  const detail = buildMilo();
  let loads = 0;
  server.use(http.get(apiUrl("/api/cases/case-milo"), () => {
    loads++;
    if (loads === 3) return new HttpResponse(null, { status: 500 });
    if (loads === 4) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(detail);
  }));
  const view = renderPanel("case-milo");
  await openMoreAction(action);
  fireEvent.change(screen.getByLabelText(field), { target: { value: "Retained fixture input" } });
  view.rerender("case-milo", new Date(2026, 1, 1));
  await waitFor(() => expect(loads).toBe(2));
  expect(screen.getByLabelText(field)).toHaveValue("Retained fixture input");
  view.rerender("case-milo", new Date(2026, 1, 2));
  expect(await screen.findByText("Unable to load this case.")).toBeInTheDocument();
  expect(screen.getByLabelText(field)).toHaveValue("Retained fixture input");
  view.rerender("case-milo", new Date(2026, 1, 3));
  expect((await screen.findAllByText("This case is no longer on the board.")).length).toBeGreaterThan(0);
  expect(screen.getByLabelText(field)).toHaveValue("Retained fixture input");
  expect(screen.getByRole("button", { name: save })).toBeDisabled();
});

describe("PatientOverviewPanel", () => {
  it("asks for a selection when no card is selected", () => {
    renderPanel(null);

    expect(screen.getByRole("complementary", { name: "Patient record" })).toBeInTheDocument();
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
    expect(screen.getByText("Care stage")).toBeInTheDocument();
    expect(screen.getByText("In treatment")).toBeInTheDocument();
  });

  it("shows the compact documented summary without duplicating review ledgers", async () => {
    const milo = buildMilo({
      nextAction: "Review radiographs",
      assignedDoctor: { id: "doctor-1", name: "Jordan Reed" },
      assignedTechnician: { id: "tech-1", name: "Sam Cruz" },
      allergiesAtIntake: "Peanuts",
      allergyStatusAtIntake: "unknownOrUnverified",
      patient: { ...buildMilo().patient, allergies: "Peanuts", allergyStatus: "unknownOrUnverified" },
      ownerUpdateStatus: "updated",
      lastOwnerUpdateAt: at(10, 52),
      nextReassessment: {
        id: "recheck-1",
        description: "Recheck respiratory status",
        dueAt: new Date(Date.now() + 8.5 * 60_000).toISOString(),
        assignedTo: { id: "tech-1", name: "Sam Cruz" }
      }
    });
    milo.vitals[0].outOfRange = ["heartRate", "respiratoryRate"];
    serveCase(milo);

    renderPanel("case-milo");

    await screen.findByRole("heading", { name: "Milo" });
    expect(screen.getByText("In treatment")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Review radiographs")).toBeInTheDocument();
    expect(screen.getByText("Recheck respiratory status · Due in 8 min")).toBeInTheDocument();
    expect(screen.getByText("Jordan Reed")).toBeInTheDocument();
    expect(screen.getByText("Sam Cruz")).toBeInTheDocument();
    // The stored status, never a guess from the text (4.12b).
    expect(screen.getByText("Peanuts · not verified", { selector: "[data-role='allergies']" })).toBeInTheDocument();
    expect(screen.getByText("Last owner update")).toBeInTheDocument();
    expect(screen.queryByText("Approved client update")).not.toBeInTheDocument();
    expect(screen.queryByText("Outside range")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Care timeline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Next actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pain score" })).not.toBeInTheDocument();
    // The record tiles became tabs (3.2c).
    expect(screen.queryByRole("region", { name: "Patient record" })).not.toBeInTheDocument();
    for (const name of ["Clinical", "Medications", "Timeline"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("says no known allergies only for a verified record", async () => {
    serveCase(buildMilo({
      allergiesAtIntake: null,
      allergyStatusAtIntake: "notRecorded",
      patient: {
        ...buildMilo().patient, allergies: null, allergyStatus: "noKnownAllergies", allergySource: "clinicRecord",
        allergiesVerifiedAt: at(9, 0), allergiesVerifiedBy: { id: "s1", name: "Jordan Reed" }
      }
    }));

    renderPanel("case-milo");

    expect(await screen.findByText("No known allergies · verified · not rechecked at this visit's intake",
      { selector: "[data-role='allergies']" })).toBeInTheDocument();
  });

  it("shows neutral missing states for stage context, action, allergies and care-team assignments", async () => {
    serveCase(buildMilo({
      nextAction: null,
      assignedDoctor: null,
      assignedTechnician: null,
      allergiesAtIntake: null,
      allergyStatusAtIntake: "notRecorded",
      patient: { ...buildMilo().patient, allergies: null, allergyStatus: "notRecorded" },
      room: null
    }));

    renderPanel("case-milo");

    expect(await screen.findByText("In treatment")).toBeInTheDocument();
    expect(screen.getByText("No next action documented")).toBeInTheDocument();
    expect(screen.getByText("No room assigned")).toBeInTheDocument();
    expect(screen.getByText("Not recorded", { selector: "[data-role='allergies']" })).toBeInTheDocument();
    expect(screen.getByText("Unassigned", { selector: "[data-role='attending-veterinarian']" })).toBeInTheDocument();
    expect(screen.getByText("Unassigned", { selector: "[data-role='primary-technician']" })).toBeInTheDocument();
    const nextAction = screen.getByRole("region", { name: "Next care action" });
    expect(within(nextAction).getByText("Last owner update")).toBeInTheDocument();
    expect(within(nextAction).getByText("Next client update")).toBeInTheDocument();
    expect(within(nextAction).getAllByText("Not scheduled").length).toBeGreaterThan(0);
  });

  it("moves task and entry actions into More actions while keeping task review case-bound", async () => {
    serveCase(buildMilo());
    const onTaskSaved = vi.fn();
    renderPanel("case-milo", new Date(), vi.fn(), onTaskSaved);

    await screen.findByRole("heading", { name: "Milo" });
    expect(screen.queryByRole("button", { name: "Add task" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Tasks and due items" }));

    const taskDialog = await screen.findByRole("dialog", { name: "Tasks and due items" });
    expect(taskDialog).toHaveTextContent("Milo");
    expect(taskDialog).toHaveTextContent("ER-2481");
    expect(within(taskDialog).getByRole("checkbox", { name: "Review radiographs" })).toBeInTheDocument();
    fireEvent.click(within(taskDialog).getByRole("button", { name: "Close tasks and due items" }));
    expect(screen.queryByRole("dialog", { name: "Tasks and due items" })).not.toBeInTheDocument();

    await openMoreAction("Record vitals");
    expect(await screen.findByRole("dialog", { name: "Record vitals" })).toBeInTheDocument();
    expect(onTaskSaved).not.toHaveBeenCalled();
  });

  it("shows the newest vitals as a neutral summary without clinical alert styling", async () => {
    const milo = buildMilo();
    milo.vitals[0].spO2 = 91;
    milo.vitals[0].outOfRange = ["heartRate", "respiratoryRate", "spO2"];
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByRole("region", { name: "Latest vitals" }));
    expect(tiles.getAllByRole("term").map((term) => term.textContent)).toEqual(["Heart rate", "Resp rate", "Temp", "SpO₂"]);
    expect(tiles.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "148 bpm", "48 /min", "38.9 °C", "91%"
    ]);
  });

  it("links to the patient's history at the end of the Overview", async () => {
    const detail = buildMilo();
    serveCase(detail);
    renderPanel("case-milo");

    const overview = within(await screen.findByRole("tabpanel", { name: "Overview" }));
    const link = overview.getByRole("link", { name: "View Patient History" });
    const careTeam = overview.getByRole("region", { name: "Care team and safety" });
    expect(careTeam.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(link);
    expect(screen.getByText(`Profile of ${detail.patient.id} from case case-milo`)).toBeInTheDocument();
  });

  it("keeps detailed observations in the Clinical tab", async () => {
    const milo = buildMilo();
    milo.vitals[0] = { ...milo.vitals[0], mucousMembraneColor: "Pink", capillaryRefillTime: "2 s",
      mentation: "<script>Alert</script>", recordedBy: { id: "s1", name: "Jordan Lee" } };
    serveCase(milo);
    renderPanel("case-milo");
    const clinical = within(await openTab("Clinical"));
    // The findings also appear in "Since the previous saved set" (4.8g).
    const assessment = within(clinical.getByRole("region", { name: "Clinical assessment" }));
    expect(assessment.getByText("Mucous membrane colour")).toBeInTheDocument();
    expect(assessment.getByText("Capillary refill time")).toBeInTheDocument();
    expect(assessment.getByText("Mentation")).toBeInTheDocument();
    expect(assessment.getByText("Pink")).toBeInTheDocument();
    expect(assessment.getByText("2 s")).toBeInTheDocument();
    expect(assessment.getByText("<script>Alert</script>")).toBeInTheDocument();
    expect(clinical.getByText("Entered")).toHaveTextContent(/^Entered 10:50 AM$/);
    expect(clinical.getByText("Entered by Jordan Lee")).toBeInTheDocument();
    expect(clinical.getByText("Measurement time unknown")).toBeInTheDocument();
  });

  it("does not backfill missing observations or invent a recorder in Clinical", async () => {
    const milo = buildMilo();
    milo.vitals[1].mentation = "Older observation";
    serveCase(milo);
    renderPanel("case-milo");
    const clinical = within(await openTab("Clinical"));
    // Counted in the vitals section; the Allergies section (4.12b) has its own.
    expect(within(clinical.getByRole("region", { name: "Latest recorded vitals" })).getAllByText("Not recorded")).toHaveLength(1);
    expect(clinical.getByText("No assessment findings recorded in this set")).toBeInTheDocument();
    expect(clinical.getByText("Entered")).toHaveTextContent(/^Entered 10:50 AM$/);
    expect(clinical.queryByText(/Entered by/)).not.toBeInTheDocument();
    expect(clinical.queryByText("Older observation")).not.toBeInTheDocument();
  });

  it("shows missing observations without recorded metadata in Clinical when no set exists", async () => {
    serveCase(buildMilo({ vitals: [] }));
    renderPanel("case-milo");
    const clinical = within(await openTab("Clinical"));
    expect(within(clinical.getByRole("region", { name: "Latest recorded vitals" })).getAllByText("Not recorded")).toHaveLength(4);
    expect(clinical.getByText("No assessment findings recorded")).toBeInTheDocument();
    expect(clinical.queryByText(/^Entered/)).not.toBeInTheDocument();
  });

  it("uses the API flags instead of inferring alerts from the values", async () => {
    const milo = buildMilo();
    milo.vitals[0].spO2 = 91;
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByRole("region", { name: "Latest vitals" }));
    expect(tiles.getByText("148 bpm")).toBeInTheDocument();
    expect(tiles.getByText("91%")).toBeInTheDocument();
    expect(tiles.queryByText("Outside range")).not.toBeInTheDocument();
  });

  it("does not turn a flagged temperature into a summary alert", async () => {
    const milo = buildMilo();
    milo.vitals[0].outOfRange = ["temperatureF"];
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByRole("region", { name: "Latest vitals" }));
    expect(tiles.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "148 bpm", "48 /min", "38.9 °C", "Not recorded"
    ]);
  });

  it("shows the latest set's measured age apart from its entry time in the summary", async () => {
    const milo = buildMilo();
    milo.vitals[0] = { ...milo.vitals[0], occurredAt: new Date(Date.now() - 150 * 60_000).toISOString(),
      recordedBy: { id: "s1", name: "Jordan Lee" } };
    milo.vitals[1].occurredAt = new Date(Date.now() - 10 * 60_000).toISOString();
    serveCase(milo);

    renderPanel("case-milo");

    const vitals = within(await screen.findByRole("region", { name: "Latest vitals" }));
    expect(vitals.getByText(/^Measured/)).toHaveTextContent(/^Measured 2 hours ago · Entered 10:50 AM · Jordan Lee$/);
    expect(vitals.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "148 bpm", "48 /min", "38.9 °C", "Not recorded"
    ]);
  });

  it("says the summary's measurement time is unknown when the latest set has none", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    const vitals = within(await screen.findByRole("region", { name: "Latest vitals" }));
    expect(vitals.getByText(/^Measurement time unknown/)).toHaveTextContent(/^Measurement time unknown · Entered 10:50 AM$/);
  });

  it("neither backfills nor flags missing readings in a partial newest set", async () => {
    const milo = buildMilo();
    milo.vitals[0] = { ...milo.vitals[0], heartRate: null, temperatureF: null, outOfRange: ["heartRate", "spO2"] };
    milo.vitals[1].spO2 = 98;
    serveCase(milo);

    renderPanel("case-milo");

    const tiles = within(await screen.findByRole("region", { name: "Latest vitals" }));
    expect(tiles.getAllByText("Not recorded")).toHaveLength(3);
    expect(tiles.queryByText("Outside range")).not.toBeInTheDocument();
    expect(tiles.getByText("48 /min")).toBeInTheDocument();
    expect(tiles.queryByText("160 bpm")).not.toBeInTheDocument();
    expect(tiles.queryByText("98%")).not.toBeInTheDocument();
  });

  it("says not recorded for every tile when no vitals exist", async () => {
    serveCase(buildMilo({ vitals: [] }));

    renderPanel("case-milo");

    const tiles = within(await screen.findByRole("region", { name: "Latest vitals" }));
    expect(tiles.getAllByText("Not recorded")).toHaveLength(4);
  });

  it("lists the recorded timeline in the Timeline tab", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    const timeline = within(await openTab("Timeline"));
    const history = within(timeline.getByRole("region", { name: "Recorded history" }));
    const items = history.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "ArrivedRespiratory distressRecorded 10:42 AM",
      "Vitals recordedMeasurement time unknownEntered 10:45 AMFirst vitals saved for this case",
      "Triage completedCriticalRecorded 10:47 AMRecorded by Jordan Reed",
      "Vitals recordedMeasurement time unknownEntered 10:50 AMCompared with the set entered 10:45 AM"
        + "Heart rate160 bpm → 148 bpmRespiratory rate60 /min → 48 /minTemperature39.4 °C → 38.9 °C"
    ]);
  });

  it("lists tasks with done and pending in the Tasks and due items view", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    await openMoreAction("Tasks and due items");
    const actions = within(await screen.findByRole("dialog", { name: "Tasks and due items" }));
    const items = actions.getAllByRole("checkbox");
    expect(items).toHaveLength(2);
    expect(items[0]).not.toBeChecked();
    expect(items[1]).toBeChecked();
  });

  it("shows empty timeline and task messages in their review views", async () => {
    serveCase(buildMilo({ timeline: [], tasks: [], vitals: [] }));

    renderPanel("case-milo");

    expect(within(await openTab("Timeline")).getByText("No history recorded")).toBeInTheDocument();
    await openMoreAction("Tasks and due items");
    expect(await screen.findByText("No tasks yet.")).toBeInTheDocument();
  });

  it("keeps owner contact actions out of the overview", async () => {
    serveCase(buildMilo());

    renderPanel("case-milo");

    await screen.findByRole("heading", { name: "Milo" });
    for (const name of ["Call", "Message"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("marks an incoming case's priority as provisional", async () => {
    serveCase(buildMilo({ stage: "incoming", acuity: "urgent" }));

    renderPanel("case-milo");

    expect(await screen.findByText("Urgent · provisional")).toBeInTheDocument();
  });

  // Case tags (build plan 3.5b).
  // Free-text tags were removed (build plan 3.5c); a tags field from an older
  // server is ignored.
  it("shows no Tags section and no Add tag control", async () => {
    serveCase({ ...buildMilo(), tags: [{ id: "t1", text: "O2 support", tone: "caution" }] } as unknown as CaseDetail);
    renderPanel("case-milo");

    await screen.findByRole("heading", { name: "Milo" });
    expect(screen.queryByRole("heading", { name: "Tags" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add tag/i })).not.toBeInTheDocument();
    expect(screen.queryByText("O2 support")).not.toBeInTheDocument();
  });

  it("shows the owner update inside Next care action, with no separate Client update card", async () => {
    serveCase(buildMilo({ lastOwnerUpdateAt: "2026-10-28T10:00:00Z", ownerUpdateStatus: "updated" }));

    renderPanel("case-milo");

    const nextAction = await screen.findByRole("region", { name: "Next care action" });
    expect(within(nextAction).getByText("Last owner update")).toBeInTheDocument();
    expect(within(nextAction).getByText("Update status: Update status recorded")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Client update" })).not.toBeInTheDocument();
  });

  // Update status (build plan 4.9b).
  it("saves a status change from More actions, reloads the board and returns focus", async () => {
    serveCase(buildMilo());
    let sent: unknown = null;
    server.use(http.patch(apiUrl("/api/cases/case-milo/status"), async ({ request }) => {
      sent = await request.json();
      return new HttpResponse(null, { status: 204 });
    }));
    const onTaskSaved = vi.fn();
    renderPanel("case-milo", undefined, undefined, onTaskSaved);

    await openMoreAction("Update status");
    const dialog = screen.getByRole("dialog", { name: "Update status" });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "waiting" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save status" }));

    expect(await screen.findByText("Status updated")).toBeInTheDocument();
    expect(sent).toMatchObject({ status: "waiting" });
    expect(onTaskSaved).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Update status" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });

  // Quick edits (build plan 4.3b).
  it("changes the care stage from the patient header and returns focus there", async () => {
    serveCase(buildMilo());
    server.use(http.patch(apiUrl("/api/cases/case-milo/status"), () => new HttpResponse(null, { status: 204 })));
    const onTaskSaved = vi.fn();
    renderPanel("case-milo", undefined, undefined, onTaskSaved);

    fireEvent.click(await screen.findByRole("button", { name: /^Change care stage/ }));
    const dialog = screen.getByRole("dialog", { name: "Update status" });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "waiting" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save status" }));

    expect(await screen.findByText("Status updated")).toBeInTheDocument();
    expect(onTaskSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /^Change care stage/ })).toHaveFocus();
  });

  it("changes the location from the patient header, reloads and returns focus there", async () => {
    serveCase(buildMilo());
    server.use(
      http.get(apiUrl("/api/rooms"), () => HttpResponse.json([
        { id: "room-1", name: "Oxygen Cage", type: "treatment", occupiedBy: { id: "case-milo", caseNumber: "ER-2481" } },
        { id: "room-icu", name: "ICU", type: "icu", occupiedBy: null }
      ])),
      http.put(apiUrl("/api/cases/case-milo/room"), () => new HttpResponse(null, { status: 204 }))
    );
    const onTaskSaved = vi.fn();
    renderPanel("case-milo", undefined, undefined, onTaskSaved);

    fireEvent.click(await screen.findByRole("button", { name: /^Change location/ }));
    const dialog = screen.getByRole("dialog", { name: "Change location" });
    await within(dialog).findByRole("option", { name: "ICU · ICU" });
    expect(within(dialog).getByLabelText("Room")).toHaveValue("room-1");
    fireEvent.change(within(dialog).getByLabelText("Room"), { target: { value: "room-icu" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save location" }));

    expect(await screen.findByText("Location updated")).toBeInTheDocument();
    expect(onTaskSaved).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Change location" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Change location/ })).toHaveFocus();
  });

  it("edits the care team from its section and reloads", async () => {
    serveCase(buildMilo());
    server.use(
      http.get(apiUrl("/api/staff/team"), () => HttpResponse.json([
        { id: "vet-lee", displayName: "Dr. Jordan Lee", initials: "JL", role: "veterinarian", status: "busy", activeCaseCount: 0, activeCases: [] }
      ])),
      http.put(apiUrl("/api/cases/case-milo/veterinarian"), () => new HttpResponse(null, { status: 204 }))
    );
    const onTaskSaved = vi.fn();
    renderPanel("case-milo", undefined, undefined, onTaskSaved);

    fireEvent.click(await screen.findByRole("button", { name: "Edit care team" }));
    const dialog = screen.getByRole("dialog", { name: "Edit care team" });
    await within(dialog).findByRole("option", { name: "Dr. Jordan Lee" });
    fireEvent.change(within(dialog).getByLabelText("Attending veterinarian"), { target: { value: "vet-lee" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save care team" }));

    expect(await screen.findByText("Care team updated")).toBeInTheDocument();
    expect(onTaskSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Edit care team" })).toHaveFocus();
  });

  it("offers no quick edits on a discharged case", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    renderPanel("case-milo");

    await screen.findByText("Milo");
    expect(screen.queryByRole("button", { name: "Change location" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Change care stage/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit care team" })).not.toBeInTheDocument();
  });

  it("leaves the case alone and returns focus when Update status is cancelled", async () => {
    serveCase(buildMilo());
    let requests = 0;
    server.use(http.patch(apiUrl("/api/cases/case-milo/status"), () => {
      requests += 1;
      return new HttpResponse(null, { status: 204 });
    }));
    renderPanel("case-milo");

    await openMoreAction("Update status");
    fireEvent.click(within(screen.getByRole("dialog", { name: "Update status" })).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Update status" })).not.toBeInTheDocument();
    expect(requests).toBe(0);
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });

  // Triage (build plan 4.2b).
  it("offers Complete triage from More actions only for an incoming case", async () => {
    serveCase(buildMilo({ stage: "incoming", acuity: "urgent" }));

    renderPanel("case-milo");

    await openMoreAction("Complete triage");
    expect(screen.getByRole("dialog", { name: "Complete triage" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Urgent" })).toBeChecked();
    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "false");
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

    await openMoreAction("Complete triage");
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

    await openMoreAction("Complete triage");
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

      expect(await screen.findByText(/Recheck pain · Due in 8 min/)).toBeInTheDocument();
      expect(screen.getByText("Next reassessment")).toBeInTheDocument();
      const nextAction = screen.getByRole("region", { name: "Next care action" });
      expect(within(nextAction).getByText("Next client update")).toBeInTheDocument();
      expect(within(nextAction).getByText("Not scheduled")).toBeInTheDocument();
    });

    it("marks an overdue item in words", async () => {
      const twelveAgo = new Date(Date.now() - 12.5 * 60_000).toISOString();
      serveCase(buildMilo({
        nextClientUpdate: { id: "c1", description: "Call owner", dueAt: twelveAgo, assignedTo: null }
      }));

      renderPanel("case-milo");

      expect(await screen.findByText(/Call owner · Overdue by 12 min/)).toBeInTheDocument();
    });

    it("offers Set with nothing scheduled and Done once something is", async () => {
      serveCase(buildMilo({
        nextReassessment: { id: "r1", description: "Recheck pain", dueAt: new Date().toISOString(), assignedTo: null },
        nextClientUpdate: null
      }));

      renderPanel("case-milo");

      await openMoreAction("Tasks and due items");
      expect(await screen.findByRole("button", { name: "Mark next reassessment done" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Close tasks and due items" }));
      await openMoreAction("Set client update");
      expect(screen.getByRole("dialog", { name: "Set client update" })).toBeInTheDocument();
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

      await openMoreAction("Tasks and due items");
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

      await openMoreAction("Tasks and due items");
      fireEvent.click(await screen.findByRole("button", { name: "Mark client update done" }));

      expect(await screen.findByText("Couldn't update the task. Try again.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark client update done" })).toBeEnabled();
    });

    it("sets a reassessment through its dialog, then reports it", async () => {
      serveCase(buildMilo({ nextReassessment: null }));
      server.use(http.post(apiUrl("/api/cases/case-milo/tasks"), () => HttpResponse.json({ id: "r2" }, { status: 201 })));
      const onTaskSaved = vi.fn();
      renderPanel("case-milo", new Date(2026, 0, 1), vi.fn(), onTaskSaved);

      await openMoreAction("Set reassessment");
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

      await openMoreAction("Add task");
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

      await openMoreAction("Add task");
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
      await openMoreAction("Tasks and due items");
      return within(await screen.findByRole("dialog", { name: "Tasks and due items" })).getByRole("checkbox", { name });
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


const reviewContent = { Clinical: "148 bpm", "Orders & Medications": "Recorded medication history", Timeline: "Respiratory distress" };

// The patient record's header and tabs (build plan 3.2c).
describe("patient record header", () => {
  it("keeps identity, acuity, care stage, location and allergies above the tabs", async () => {
    serveCase(buildMilo({ patient: { ...buildMilo().patient, allergies: "Penicillin", allergyStatus: "documentedAllergies" } }));
    renderPanel("case-milo");

    const name = await screen.findByRole("heading", { level: 3, name: "Milo" });
    const tabs = screen.getByRole("tablist", { name: "Patient record sections" });
    const stage = screen.getByRole("button", { name: "Change care stage, currently In treatment" });
    const location = screen.getByRole("button", { name: "Change location, currently Treatment · Oxygen Cage" });
    // The header's line comes first; Care team & safety repeats the summary.
    const allergies = screen.getAllByText(/^Penicillin · verified/)[0];
    expect(allergies).toHaveTextContent("Allergies: Penicillin · verified");
    expect(allergies).toHaveAttribute("data-status", "documentedAllergies");
    for (const element of [name, stage, location, allergies]) {
      expect(element.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("opens allergy details on the Clinical tab from the header", async () => {
    serveCase(buildMilo({ patient: { ...buildMilo().patient, allergies: "Penicillin", allergyStatus: "documentedAllergies" } }));
    renderPanel("case-milo");

    fireEvent.click(await screen.findByRole("button", { name: "Allergies: Penicillin · verified · not rechecked at this visit's intake. Show allergy details" }));

    expect(screen.getByRole("tab", { name: "Clinical" })).toHaveAttribute("aria-selected", "true");
    const details = within(screen.getByRole("tabpanel", { name: "Clinical" })).getByRole("group", { name: "Allergy details" });
    expect(details).toHaveAttribute("open");
    expect(within(details).getByText((_, element) => element?.tagName === "SUMMARY")).toHaveFocus();
  });

  it("opens allergy details from the header when Clinical is already selected", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    renderPanel("case-milo");
    const clinical = within(await openTab("Clinical"));
    const details = clinical.getByRole("group", { name: "Allergy details" });
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: /^Allergies: .+\. Show allergy details$/ }));

    expect(details).toHaveAttribute("open");
    expect(within(details).getByText((_, element) => element?.tagName === "SUMMARY")).toHaveFocus();
  });

  it("shows the compact header: name, acuity, More actions and the case reference in the meta line", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");

    const name = await screen.findByRole("heading", { level: 3, name: "Milo" });
    const acuity = screen.getByRole("button", { name: "Change acuity, currently Critical" });
    const moreActions = screen.getByRole("button", { name: "More actions" });
    const close = screen.getByRole("button", { name: "Back to patient board" });
    for (const [first, second] of [[name, acuity], [acuity, moreActions], [moreActions, close]]) {
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByText(/^Dog · Golden Retriever/)).toHaveTextContent(/31\.4 kg Case ER-2481·Checked in 10:42 AM$/);
  });

  it("keeps the panel named Patient record and shows the heading only without a patient", async () => {
    serveCase(buildMilo());
    const view = renderPanel("case-milo");

    await screen.findByRole("heading", { level: 3, name: "Milo" });
    expect(screen.getByRole("complementary", { name: "Patient record" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Patient record" }).className).toMatch(/visuallyHidden/);
    view.rerender(null, new Date());
    expect(screen.getByRole("heading", { level: 2, name: "Patient record" }).className).not.toMatch(/visuallyHidden/);
  });

  it("opens triage from the acuity button and returns focus to it", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");

    const acuity = await screen.findByRole("button", { name: "Change acuity, currently Critical" });
    fireEvent.click(acuity);
    const dialog = screen.getByRole("dialog", { name: "Re-triage" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(acuity).toHaveFocus());
  });

  it("opens Complete triage from the acuity button on an incoming case", async () => {
    serveCase(buildMilo({ stage: "incoming" }));
    renderPanel("case-milo");

    fireEvent.click(await screen.findByRole("button", { name: "Change acuity, currently Critical · provisional" }));

    expect(screen.getByRole("dialog", { name: "Complete triage" })).toBeInTheDocument();
  });

  it("shows acuity as plain text on a discharged case", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    renderPanel("case-milo");

    await screen.findByRole("heading", { level: 3, name: "Milo" });
    expect(screen.queryByRole("button", { name: /^Change acuity/ })).not.toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("asks to close from the Back to patient board button", async () => {
    serveCase(buildMilo());
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <ToastProvider>
          <PatientOverviewPanel caseId="case-milo" signedInUser={signedInUser} refreshedAt={new Date()} onTriaged={vi.fn()}
            onTaskSaved={vi.fn()} onVitalsSaved={vi.fn()} onClose={onClose} />
        </ToastProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Back to patient board" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows care stage and location as plain text on a discharged case", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    renderPanel("case-milo");

    await screen.findByRole("heading", { level: 3, name: "Milo" });
    expect(screen.queryByRole("button", { name: /^Change care stage/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Change location/ })).not.toBeInTheDocument();
    expect(screen.getByText("Treatment · Oxygen Cage")).toBeInTheDocument();
  });
});

describe("patient record tabs", () => {
  function tabNames() {
    return screen.getAllByRole("tab").map(tab => tab.textContent);
  }

  it("shows the four tabs with Overview selected", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");

    expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(tabNames()).toEqual(["Overview", "Clinical", "Orders & Medications", "Timeline"]);
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map(tab => tab.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it.each(["Clinical", "Orders & Medications", "Timeline"] as const)("shows %s from the loaded detail without reading it again", async kind => {
    const reads = serveCase(buildMilo({ medicationsAtIntake: "Recorded medication history" }));
    renderPanel("case-milo");

    const panel = within(await openTab(kind));

    expect(panel.getByText(reviewContent[kind])).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: kind })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "false");
    expect(reads()).toBe(1);
  });

  it("offers the tabs on a discharged record too", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    renderPanel("case-milo");

    expect(within(await openTab("Timeline")).getByText("Respiratory distress")).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys, Home and End", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");
    const tablist = within(await screen.findByRole("tablist", { name: "Patient record sections" }));
    const press = (key: string) => fireEvent.keyDown(screen.getByRole("tablist", { name: "Patient record sections" }), { key });
    tablist.getByRole("tab", { name: "Overview" }).focus();

    press("ArrowRight");
    expect(tablist.getByRole("tab", { name: "Clinical" })).toHaveFocus();
    expect(tablist.getByRole("tab", { name: "Clinical" })).toHaveAttribute("aria-selected", "true");
    press("End");
    expect(tablist.getByRole("tab", { name: "Timeline" })).toHaveFocus();
    press("ArrowRight");
    expect(tablist.getByRole("tab", { name: "Overview" })).toHaveFocus();
    press("ArrowLeft");
    expect(tablist.getByRole("tab", { name: "Timeline" })).toHaveFocus();
    press("Home");
    expect(tablist.getByRole("tab", { name: "Overview" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeInTheDocument();
  });

  it("updates the open tab from a same-case refresh and keeps it open", async () => {
    const milo = buildMilo();
    serveCase(milo);
    const view = renderPanel("case-milo");
    await openTab("Clinical");
    serveCase({ ...milo, vitals: [{ ...milo.vitals[0], heartRate: 95, recordedBy: { id: "fresh-recorder", name: "Fresh Recorder" } }] });

    view.rerender("case-milo", new Date());

    expect(await within(screen.getByRole("tabpanel", { name: "Clinical" })).findByText(/Fresh Recorder/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Clinical" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens a newly selected patient on Overview", async () => {
    serveCase(buildMilo());
    serveCase(buildCaseDetail({ id: "case-second" }));
    const view = renderPanel("case-milo");
    await openTab("Timeline");

    view.rerender("case-second", new Date());

    expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Respiratory distress")).not.toBeInTheDocument();
  });

  it("shows no review content once the patient is deselected", async () => {
    serveCase(buildMilo());
    const view = renderPanel("case-milo");
    await openTab("Timeline");

    view.rerender(null, new Date());

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("Respiratory distress")).not.toBeInTheDocument();
  });

  it("keeps an old patient's late reply out of the new patient's record", async () => {
    const milo = buildMilo();
    const second = buildCaseDetail({ id: "case-second" });
    serveCase(milo);
    const view = renderPanel("case-milo");
    await openTab("Timeline");
    let finishOld!: (detail: CaseDetail | null) => void;
    const oldReply = new Promise<CaseDetail | null>(resolve => { finishOld = resolve; });
    const loader = vi.spyOn(casesApi, "getCase").mockReturnValueOnce(oldReply).mockResolvedValueOnce(second);
    view.rerender("case-milo", new Date());
    await waitFor(() => expect(loader).toHaveBeenCalledWith("case-milo"));
    view.rerender(second.id, new Date());
    const timeline = within(await openTab("Timeline"));

    await act(async () => { finishOld(milo); await oldReply; });

    expect(screen.getByRole("heading", { level: 3, name: second.patient.name })).toBeInTheDocument();
    expect(timeline.queryByText("Respiratory distress")).not.toBeInTheDocument();
  });

  it.each([404, 500])("hides the record after refetch %s and shows it again after recovery", async status => {
    const milo = buildMilo();
    serveCase(milo);
    const view = renderPanel("case-milo");
    await openTab("Timeline");
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status })));

    view.rerender("case-milo", new Date());

    await screen.findByText(status === 404 ? "This case is no longer on the board." : "Unable to load this case.");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("Respiratory distress")).not.toBeInTheDocument();
    serveCase(milo);
    if (status === 500) fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    else view.rerender("case-milo", new Date());
    expect(await screen.findByRole("tablist", { name: "Patient record sections" })).toBeInTheDocument();
  });

  it.each([[401, "Sign-in page"], [403, "Pet parent home"]])("clears the private record on refusal %s", async (status, destination) => {
    serveCase(buildMilo({ medicationsAtIntake: "Recorded medication history" }));
    saveAccessToken("demo-session");
    const view = renderPanel("case-milo");
    await openTab("Orders & Medications");
    server.use(http.get(apiUrl("/api/cases/case-milo"), () => new HttpResponse(null, { status: Number(status) })));

    view.rerender("case-milo", new Date());

    await screen.findByText(destination);
    expect(screen.queryByText("Recorded medication history")).not.toBeInTheDocument();
  });
});

describe("recording vitals in the overview", () => {
  it("offers entry only after an active case loads", async () => {
    serveCase(buildMilo());
    const view = renderPanel(null);
    expect(screen.queryByRole("button", { name: "Record vitals" })).not.toBeInTheDocument();
    view.rerender("case-milo", new Date());
    expect(screen.queryByRole("button", { name: "Record vitals" })).not.toBeInTheDocument();
    await openMoreAction("Record vitals");
    expect(screen.getByRole("dialog", { name: "Record vitals" })).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    expect(within(await screen.findByRole("list", { name: "More actions" })).getByRole("button", { name: "Record vitals" })).toBeDisabled();
  });

  it("discards a cancelled draft, restores focus and reopens the latest saved values", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");
    await openMoreAction("Record vitals");
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
    await openMoreAction("Record vitals");
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("148");
  });

  it("retains the opening set during a background update and prefills the new set only on reopening", async () => {
    const milo = buildMilo();
    serveCase(milo);
    const view = renderPanel("case-milo");
    await openMoreAction("Record vitals");
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    serveCase({ ...milo, vitals: [{ ...milo.vitals[0], heartRate: 120, temperatureF: 80, mentation: "Updated" }] });
    view.rerender("case-milo", new Date());
    await screen.findByText("120 bpm");
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("90");
    expect(screen.getByLabelText("Temperature (°C)")).toHaveValue("38.9");
    expect(screen.getByLabelText("Mentation")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await openMoreAction("Record vitals");
    expect(screen.getByLabelText("Heart rate (bpm)")).toHaveValue("120");
    expect(screen.getByLabelText("Temperature (°C)")).toHaveValue("26.7");
    expect(screen.getByLabelText("Mentation")).toHaveValue("Updated");
  });

  it.each([200, 500])("preserves a draft across a same-case refresh returning %s", async status => {
    serveCase(buildMilo());
    const view = renderPanel("case-milo");
    await openMoreAction("Record vitals");
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
    await openMoreAction("Record vitals");
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    view.rerender(second.id, new Date());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await openMoreAction("Record vitals");
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
    await openMoreAction("Record vitals");
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
    expect(write).toHaveBeenCalledWith("case-milo", { heartRate: 90, respiratoryRate: 48, temperatureF: 102 });
    view.rerender("case-second", new Date());
    await openMoreAction("Record vitals");
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
    await openMoreAction("Record vitals");
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "95" } });
    fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
    expect(await screen.findByText("95 bpm")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Vitals recorded");
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
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
    await openMoreAction("Record vitals");
    fireEvent.change(screen.getByLabelText("Heart rate (bpm)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This case has been discharged.");
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Save vitals" })).toBeDisabled();
    expect(screen.queryByText("Vitals recorded")).not.toBeInTheDocument();
  });
});

describe("overview tab", () => {
  function inOrder(elements: HTMLElement[]) {
    return elements.every((element, index) => {
      const previous = elements[index - 1];
      return !previous || Boolean(previous.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
  }

  it("shows the sections in the prototype's order", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");

    await screen.findByRole("heading", { level: 3, name: "Milo" });
    expect(inOrder([
      screen.getByRole("region", { name: "Latest vitals" }),
      screen.getByRole("region", { name: "Next care action" }),
      screen.getByRole("region", { name: "Care team and safety" }),
      screen.getByRole("region", { name: "Presenting complaint" }),
      screen.getByText(/^Last updated/),
      screen.getByRole("link", { name: "View Patient History" })
    ])).toBe(true);
  });

  it("lists the technician before the veterinarian", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");

    const careTeam = await screen.findByRole("region", { name: "Care team and safety" });
    expect(inOrder([
      within(careTeam).getByText("Primary technician"),
      within(careTeam).getByText("Attending veterinarian"),
      within(careTeam).getByText("Allergies"),
      within(careTeam).getByText("Pet parent")
    ])).toBe(true);
  });

  it("shows Unassigned for a missing assignment", async () => {
    serveCase(buildMilo({ assignedTechnician: null, assignedDoctor: { id: "s1", name: "Jordan Reed" } }));
    renderPanel("case-milo");

    expect(await screen.findByText("Unassigned", { selector: "[data-role='primary-technician']" })).toBeInTheDocument();
    expect(screen.getByText("Jordan Reed", { selector: "[data-role='attending-veterinarian']" })).toBeInTheDocument();
  });

  it("shows the presenting complaint read-only, without an Edit action", async () => {
    serveCase(buildMilo({ presentingComplaint: "Respiratory distress" }));
    renderPanel("case-milo");

    const complaint = await screen.findByRole("region", { name: "Presenting complaint" });
    expect(complaint).toHaveTextContent("Respiratory distress");
    expect(within(complaint).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens Record vitals from the vitals section and returns focus to it on close", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");

    const vitals = await screen.findByRole("region", { name: "Latest vitals" });
    const recordVitals = within(vitals).getByRole("button", { name: "Record vitals" });
    fireEvent.click(recordVitals);
    expect(await screen.findByRole("dialog", { name: "Record vitals" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(recordVitals).toHaveFocus();
  });

  it("has no Record vitals button in the vitals section for a discharged case", async () => {
    serveCase(buildMilo({ dischargedAt: at(11, 0) }));
    renderPanel("case-milo");

    const vitals = await screen.findByRole("region", { name: "Latest vitals" });
    expect(within(vitals).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Assign me on the veterinarian row to a signed-in veterinarian", async () => {
    serveCase(buildMilo());
    renderPanel("case-milo");

    const careTeam = await screen.findByRole("region", { name: "Care team and safety" });
    expect(within(careTeam).getByRole("button", { name: "Assign me as attending veterinarian" })).toBeInTheDocument();
    expect(within(careTeam).queryByRole("button", { name: "Assign me as primary technician" })).not.toBeInTheDocument();
  });

  it("offers Assign me on the technician row to a signed-in technician", async () => {
    signedInUser = buildTeamMember({ name: "Sam Cruz", displayName: "Sam Cruz", initials: "SC", role: "technician", staffId: "staff-sam" });
    serveCase(buildMilo());
    renderPanel("case-milo");

    const careTeam = await screen.findByRole("region", { name: "Care team and safety" });
    expect(within(careTeam).getByRole("button", { name: "Assign me as primary technician" })).toBeInTheDocument();
    expect(within(careTeam).queryByRole("button", { name: "Assign me as attending veterinarian" })).not.toBeInTheDocument();
  });

  it.each([
    ["already assigned", buildMilo({ assignedDoctor: { id: "staff-jordan-lee", name: "Jordan Lee" } }), buildTeamMember()],
    ["discharged", buildMilo({ dischargedAt: at(11, 0) }), buildTeamMember()],
    ["another role", buildMilo(), buildTeamMember({ role: "receptionist" })]
  ])("hides Assign me when %s", async (_reason, detail, user) => {
    signedInUser = user;
    serveCase(detail);
    renderPanel("case-milo");

    const careTeam = await screen.findByRole("region", { name: "Care team and safety" });
    expect(within(careTeam).queryByRole("button", { name: /^Assign me/ })).not.toBeInTheDocument();
  });

  it("assigns the signed-in member, shows a toast and reloads", async () => {
    let body: unknown = null;
    server.use(
      http.put(apiUrl("/api/cases/case-milo/veterinarian"), async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );
    serveCase(buildMilo());
    const onTaskSaved = vi.fn();
    renderPanel("case-milo", new Date(), vi.fn(), onTaskSaved);

    fireEvent.click(await screen.findByRole("button", { name: "Assign me as attending veterinarian" }));

    expect(await screen.findByText("Assigned to you as attending veterinarian")).toBeInTheDocument();
    expect(body).toEqual({ id: "staff-jordan-lee" });
    expect(onTaskSaved).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Edit care team" })).toHaveFocus();
  });

  it("says the case is gone when assigning returns 404", async () => {
    server.use(http.put(apiUrl("/api/cases/case-milo/veterinarian"), () => new HttpResponse(null, { status: 404 })));
    serveCase(buildMilo());
    const onTaskSaved = vi.fn();
    renderPanel("case-milo", new Date(), vi.fn(), onTaskSaved);

    fireEvent.click(await screen.findByRole("button", { name: "Assign me as attending veterinarian" }));

    const careTeam = screen.getByRole("region", { name: "Care team and safety" });
    expect(await within(careTeam).findByRole("alert")).toHaveTextContent("This case is no longer on the board.");
    expect(onTaskSaved).not.toHaveBeenCalled();
  });

  it("shows the field message when assigning returns 400", async () => {
    server.use(http.put(apiUrl("/api/cases/case-milo/veterinarian"), () =>
      HttpResponse.json({ errors: { id: ["Choose an active veterinarian."] } }, { status: 400 })));
    serveCase(buildMilo());
    renderPanel("case-milo");

    fireEvent.click(await screen.findByRole("button", { name: "Assign me as attending veterinarian" }));

    const careTeam = screen.getByRole("region", { name: "Care team and safety" });
    expect(await within(careTeam).findByRole("alert")).toHaveTextContent("Choose an active veterinarian.");
    expect(within(careTeam).getByRole("button", { name: "Assign me as attending veterinarian" })).toBeEnabled();
  });

  it("names who last updated the case when the newest event matches", async () => {
    // buildMilo's newest event is the 10:47 triage by Jordan Reed.
    serveCase(buildMilo({ lastUpdated: at(10, 47) }));
    renderPanel("case-milo");

    expect(await screen.findByText(/^Last updated .+ by Jordan Reed$/)).toBeInTheDocument();
  });

  it("shows only the time when no event matches the last update", async () => {
    serveCase(buildMilo({ lastUpdated: at(11, 5) }));
    renderPanel("case-milo");

    const saveState = await screen.findByText(/^Last updated/);
    expect(saveState).not.toHaveTextContent(" by ");
  });
});
