import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { createCaseHubConnection } from "../services/caseHub";
import { saveAccessToken } from "../services/session";
import { buildBoardSummary, buildCase, buildCaseDetail, buildCaseTask, buildPainScore, buildTeamMember, buildVitalsRecord } from "../test/builders";
import { createFakeCaseHub } from "../test/fakeCaseHub";
import { apiUrl, server } from "../test/server";
import type { BoardSummary } from "../types/BoardSummary";
import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";
import { AppShell } from "../components/shell/AppShell";
import { ToastProvider } from "../components/shell/Toast";
import { ErBoardPage } from "./ErBoardPage";
import { ClinicalDraftProvider } from "../components/forms/ClinicalDraftProvider";

vi.mock("../services/caseHub", () => ({
  createCaseHubConnection: vi.fn()
}));

let hub: ReturnType<typeof createFakeCaseHub>;

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

beforeEach(() => {
  hub = createFakeCaseHub();
  vi.mocked(createCaseHubConnection).mockReturnValue(hub.asHubConnection());
});

afterEach(() => {
  sessionStorage.clear();
});

function serveCases(cases: EmergencyCaseListItem[]) {
  server.use(http.get(apiUrl("/api/cases"), () => HttpResponse.json(cases)));
}

function serveSummary(summary: BoardSummary) {
  server.use(http.get(apiUrl("/api/board/summary"), () => HttpResponse.json(summary)));
}

function statCard(name: RegExp) {
  return within(screen.getByRole("region", { name: "Board summary" })).getByRole("button", { name });
}

async function findLane(name: string) {
  return screen.findByRole("region", { name });
}

// Shows the router state the board leaves on /sign-in, so tests can read it.
function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={["/er"]}>
      <ClinicalDraftProvider>
      <Routes>
        <Route path="/er" element={<ToastProvider><ErBoardPage /></ToastProvider>} />
        <Route path="/sign-in" element={<SignInStub />} />
      </Routes>
      </ClinicalDraftProvider>
    </MemoryRouter>
  );
}

it("guards patient selection and retains the draft on board failure or departure", async () => {
  serveCases([buildCase({ id: "case-buddy", patientName: "Buddy" }), buildCase({ id: "case-max", patientName: "Max" })]);
  server.use(http.get(apiUrl("/api/cases/case-buddy"), () => HttpResponse.json(buildCaseDetail({ id: "case-buddy", acuity: "urgent" }))));
  renderBoard();
  fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Re-triage" }));
  const notes = within(screen.getByRole("dialog", { name: "Re-triage" })).getByLabelText("Triage notes");
  fireEvent.change(notes, { target: { value: "Retain the original encounter" } });
  fireEvent.click(screen.getByRole("button", { name: "Max" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByRole("button", { name: "Buddy" })).toHaveAttribute("aria-pressed", "true");
  server.use(http.get(apiUrl("/api/cases"), () => new HttpResponse(null, { status: 500 })));
  hub.emit("caseUpdated", "case-buddy");
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load emergency cases.");
  expect(notes).toHaveValue("Retain the original encounter");
  serveCases([]);
  hub.emit("caseUpdated", "case-buddy");
  await waitFor(() => expect(screen.getByRole("button", { name: "Save priority" })).toBeDisabled());
  expect(notes).toHaveValue("Retain the original encounter");
  expect(screen.queryByText("Select a patient on the board to see their overview.")).not.toBeInTheDocument();
});

describe("ErBoardPage", () => {
  // "Sends the person to sign in when the session has ended" was removed: it
  // timed out in full Verify runs. Build plan 7.9 restores it.

  it("shows a loading message until the cases arrive", async () => {
    renderBoard();

    expect(screen.getByText("Loading emergency cases...")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Northside Veterinary Emergency" })
    ).toBeInTheDocument();
  });

  // The heading (build plan 2.15b), from the board summary.
  it("shows the clinic and the live shift chip in the heading", async () => {
    serveSummary(buildBoardSummary({ clinicName: "Northside Veterinary Emergency", cliniciansOnFloor: 4 }));

    renderBoard();

    expect(await screen.findByText("Day shift · 4 clinicians on floor")).toBeInTheDocument();
    expect(screen.getByText("Northside Veterinary Emergency")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Northside Veterinary Emergency" })).toBeInTheDocument();
  });

  it("names the browser tab while loading and once loaded", async () => {
    serveCases([buildCase()]);
    renderBoard();

    expect(document.title).toBe("ER Board · VetiFlow");
    await screen.findByRole("heading", { level: 1, name: "Northside Veterinary Emergency" });
    expect(document.title).toBe("ER Board · VetiFlow");
  });

  it("places each case in the lane for its acuity", async () => {
    serveCases([
      buildCase({ patientName: "Buddy", acuity: "critical" }),
      buildCase({ patientName: "Mittens", acuity: "stable" })
    ]);

    renderBoard();

    expect(
      within(await findLane("Critical")).getByRole("heading", { name: "Buddy" })
    ).toBeInTheDocument();
    expect(
      within(await findLane("Stable")).getByRole("heading", { name: "Mittens" })
    ).toBeInTheDocument();
    expect(within(await findLane("Urgent")).getByText("No patients")).toBeInTheDocument();
  });

  // The API sorts by acuity and wait; the board must not reorder within a lane.
  it("lists a lane's cards in the order the API sent them", async () => {
    serveCases([
      buildCase({ patientName: "Rex", acuity: "urgent" }),
      buildCase({ patientName: "Bella", acuity: "urgent" }),
      buildCase({ patientName: "Coco", acuity: "urgent" })
    ]);

    renderBoard();

    const names = within(await findLane("Urgent"))
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["Rex", "Bella", "Coco"]);
  });

  it("shows the three acuity lanes in order", async () => {
    renderBoard();

    await findLane("Critical");
    const lanes = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent?.replace("● ", ""));

    expect(lanes).toEqual(["Critical", "Urgent", "Stable"]);
  });

  it("selects a card when it is pressed", async () => {
    serveCases([buildCase({ patientName: "Buddy" }), buildCase({ patientName: "Max" })]);
    renderBoard();

    const buddy = await screen.findByRole("button", { name: "Buddy" });
    fireEvent.click(buddy);

    expect(buddy).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Max" })).toHaveAttribute("aria-pressed", "false");
  });

  // Patient overview panel (build plan 3.2b).
  it("shows the selected card's case in the patient overview", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () =>
      HttpResponse.json(buildCaseDetail({ id: "case-buddy", caseNumber: "ER-2481" }))));
    renderBoard();
    const overview = await screen.findByRole("complementary", { name: "Patient overview" });
    expect(within(overview).getByText("Select a patient on the board to see their overview.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));

    expect(await within(overview).findByText(/Case ER-2481/)).toBeInTheDocument();
  });

  it("loads the shown case again when the server reports a case update", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    let detailRequests = 0;
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () => {
      detailRequests += 1;
      return HttpResponse.json(buildCaseDetail({ id: "case-buddy", weightKg: detailRequests === 1 ? 12 : 13 }));
    }));
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    const overview = screen.getByRole("complementary", { name: "Patient overview" });
    await within(overview).findByText(/12 kg/);

    hub.emit("caseUpdated", buddy.id);

    expect(await within(overview).findByText(/13 kg/)).toBeInTheDocument();
  });

  it("empties the patient overview when the selected case leaves the board", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    const overview = screen.getByRole("complementary", { name: "Patient overview" });
    await within(overview).findByText(/Case ER-/);

    serveCases([]);
    hub.emit("caseUpdated", buddy.id);

    expect(await within(overview).findByText("Select a patient on the board to see their overview.")).toBeInTheDocument();
  });

  // Triage from the panel (build plan 4.2b).
  it("completes triage on an incoming card and updates the board and panel", async () => {
    const toby = buildCase({ id: "case-toby", patientName: "Toby", stage: "incoming", acuity: "urgent", waitChip: "new" });
    const tobyDetail = buildCaseDetail({ id: "case-toby", stage: "incoming", acuity: "urgent" });
    serveCases([toby]);
    let triaged = false;
    server.use(
      http.get(apiUrl("/api/cases/case-toby"), () =>
        HttpResponse.json(triaged ? { ...tobyDetail, stage: "triage" } : tobyDetail)),
      http.post(apiUrl("/api/cases/case-toby/triage"), () => {
        triaged = true;
        serveCases([{ ...toby, stage: "triage", waitChip: "minutes" }]);
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderBoard();
    const lane = await findLane("Urgent");
    expect(within(lane).getByText("Urgent · provisional")).toBeInTheDocument();
    fireEvent.click(within(lane).getByRole("button", { name: "Toby" }));

    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete triage" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Complete triage" })).getByRole("button", { name: "Complete triage" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/triage completed/);
    await vi.waitFor(() => expect(within(lane).queryByText("Urgent · provisional")).not.toBeInTheDocument());
    expect(within(lane).queryByText("New")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("button", { name: "Re-triage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeEnabled();
  });

  it("shows an error when the cases cannot be loaded", async () => {
    server.use(
      http.get(apiUrl("/api/cases"), () => new HttpResponse(null, { status: 500 }))
    );

    renderBoard();

    expect(
      await screen.findByText("Unable to load emergency cases.")
    ).toBeInTheDocument();
  });

  it("reloads the board when the server reports a case update", async () => {
    const buddy = buildCase({ patientName: "Buddy", acuity: "urgent" });
    serveCases([buddy]);
    renderBoard();
    await within(await findLane("Urgent")).findByRole("heading", { name: "Buddy" });

    serveCases([{ ...buddy, acuity: "critical" }]);
    hub.emit("caseUpdated", buddy.id);

    expect(
      await within(await findLane("Critical")).findByRole("heading", { name: "Buddy" })
    ).toBeInTheDocument();
    expect(within(await findLane("Urgent")).getByText("No patients")).toBeInTheDocument();
  });

  it("still shows the board when live updates cannot connect", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    hub.connection.start.mockRejectedValue(new Error("Hub unavailable"));
    serveCases([buildCase({ patientName: "Buddy" })]);

    renderBoard();

    expect(await screen.findByRole("heading", { name: "Buddy" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to connect to live case updates.",
      expect.any(Error)
    );
  });

  it("disconnects from live updates when the page closes", async () => {
    const { unmount } = renderBoard();
    await findLane("Critical");

    unmount();

    expect(hub.isListening("caseUpdated")).toBe(false);
    expect(hub.connection.stop).toHaveBeenCalled();
  });
  // New patient intake (build plan 4.1b): the new case shows in its lane,
  // selected, with a toast.
  it("adds an intake to the board, selects it and says so", async () => {
    const toby = buildCase({ id: "case-toby", patientName: "Toby", stage: "incoming", acuity: "urgent", waitChip: "new" });
    serveCases([]);
    server.use(http.post(apiUrl("/api/cases/intake"), () =>
      HttpResponse.json({ id: "case-toby", caseNumber: "ER-2489", patientId: "patient-toby" }, { status: 201 })));
    renderBoard();

    fireEvent.click(await screen.findByRole("button", { name: "New intake" }));
    const dialog = screen.getByRole("dialog", { name: "New patient intake" });
    fireEvent.change(within(dialog).getByLabelText("Patient name *"), { target: { value: "Toby" } });
    fireEvent.change(within(dialog).getByLabelText("Species *"), { target: { value: "Dog" } });
    fireEvent.change(within(dialog).getByLabelText("Pet parent / guardian *"), { target: { value: "Jo Mills" } });
    fireEvent.change(within(dialog).getByLabelText("Phone number *"), { target: { value: "312-555-0177" } });
    fireEvent.change(within(dialog).getByLabelText("Chief complaint *"), { target: { value: "Acute vomiting" } });
    fireEvent.click(within(dialog).getByLabelText("Urgent"));
    serveCases([toby]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to triage queue" }));

    const card = await within(await findLane("Urgent")).findByRole("button", { name: "Toby" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Toby added to triage queue");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The stat cards (build plan 2.12b).
  describe("stat cards", () => {
    const boardCases = () => [
      buildCase({ patientName: "Toby", acuity: "urgent", stage: "incoming" }),
      buildCase({ patientName: "Milo", acuity: "critical", stage: "treatment" }),
      buildCase({ patientName: "Pip", acuity: "stable", stage: "recheck" })
    ];

    it("fills the cards from the summary, with Patients in care pressed", async () => {
      serveCases(boardCases());
      serveSummary(buildBoardSummary({ patientsInCare: 3, awaitingTriage: 1, criticalPatients: 1 }));
      renderBoard();

      await screen.findByRole("heading", { name: "Milo" });
      expect(statCard(/patients in care/i)).toHaveTextContent("3");
      expect(statCard(/patients in care/i)).toHaveAttribute("aria-pressed", "true");
      expect(statCard(/awaiting triage/i)).toHaveTextContent("1");
      expect(statCard(/critical patients/i)).toHaveTextContent("1");
    });

    it("filters the board to the triage queue, then to critical, then back to all", async () => {
      serveCases(boardCases());
      serveSummary(buildBoardSummary({ patientsInCare: 3, awaitingTriage: 1, criticalPatients: 1 }));
      renderBoard();
      await screen.findByRole("heading", { name: "Milo" });

      fireEvent.click(statCard(/awaiting triage/i));

      expect(statCard(/awaiting triage/i)).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("heading", { name: "Toby" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Milo" })).not.toBeInTheDocument();

      fireEvent.click(statCard(/critical patients/i));

      expect(screen.getByRole("heading", { name: "Milo" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Toby" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Stable" })).not.toBeInTheDocument();

      fireEvent.click(statCard(/patients in care/i));

      expect(screen.getAllByRole("article")).toHaveLength(3);
    });

    it("keeps the board as it is when nobody awaits triage", async () => {
      serveCases(boardCases());
      serveSummary(buildBoardSummary({ patientsInCare: 3, awaitingTriage: 0 }));
      renderBoard();
      await screen.findByRole("heading", { name: "Milo" });

      fireEvent.click(statCard(/awaiting triage/i));

      expect(screen.getByRole("status")).toHaveTextContent("No patients awaiting triage");
      expect(statCard(/patients in care/i)).toHaveAttribute("aria-pressed", "true");
      expect(screen.getAllByRole("article")).toHaveLength(3);
    });

    // The Incoming toggle shares the card's filter (build plan 2.14b).
    it("presses the Incoming toggle and the Awaiting triage card together", async () => {
      serveCases(boardCases());
      serveSummary(buildBoardSummary({ patientsInCare: 3, awaitingTriage: 1 }));
      renderBoard();
      await screen.findByRole("heading", { name: "Milo" });
      const toggle = screen.getByRole("button", { name: "Incoming, 1 awaiting triage" });

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(statCard(/awaiting triage/i)).toHaveAttribute("aria-pressed", "true");
      expect(screen.getAllByRole("article")).toHaveLength(1);

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(statCard(/patients in care/i)).toHaveAttribute("aria-pressed", "true");
      expect(screen.getAllByRole("article")).toHaveLength(3);

      fireEvent.click(statCard(/awaiting triage/i));

      expect(toggle).toHaveAttribute("aria-pressed", "true");
    });

    it("keeps the board as it is when the Incoming toggle finds an empty queue", async () => {
      serveCases([buildCase({ patientName: "Milo", acuity: "critical", stage: "treatment" })]);
      serveSummary(buildBoardSummary({ patientsInCare: 1, awaitingTriage: 0 }));
      renderBoard();
      await screen.findByRole("heading", { name: "Milo" });

      fireEvent.click(screen.getByRole("button", { name: "Incoming, 0 awaiting triage" }));

      expect(screen.getByRole("status")).toHaveTextContent("No patients awaiting triage");
      expect(screen.getByRole("button", { name: "Incoming, 0 awaiting triage" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getAllByRole("article")).toHaveLength(1);
    });

    it("loads the summary again when the server reports a case update", async () => {
      serveCases(boardCases());
      serveSummary(buildBoardSummary({ patientsInCare: 3 }));
      renderBoard();
      await screen.findByRole("heading", { name: "Milo" });

      serveSummary(buildBoardSummary({ patientsInCare: 4 }));
      hub.emit("caseUpdated", "case-new");

      await waitFor(() => expect(statCard(/patients in care/i)).toHaveTextContent("4"));
    });

    it("keeps the board up with dashes when only the summary fails", async () => {
      serveCases(boardCases());
      server.use(http.get(apiUrl("/api/board/summary"), () => new HttpResponse(null, { status: 500 })));
      renderBoard();

      expect(await screen.findByRole("heading", { name: "Milo" })).toBeInTheDocument();
      expect(statCard(/patients in care/i)).toHaveTextContent("—");
      expect(statCard(/patients in care/i)).toHaveTextContent("Not available");
    });

    it("sends the person to sign in when the summary reports the session ended", async () => {
      saveAccessToken("expired");
      server.use(http.get(apiUrl("/api/board/summary"), () => new HttpResponse(null, { status: 401 })));

      renderBoard();

      expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
    });
  });

  // The top bar's search (build plan 2.14a), with the board inside the shell.
  it("filters the board as text is typed in the top bar", async () => {
    serveCases([
      buildCase({ patientName: "Milo", acuity: "critical" }),
      buildCase({ patientName: "Pip", acuity: "stable" })
    ]);
    render(
      <MemoryRouter initialEntries={["/er"]}>
        <Routes>
          <Route path="/er" element={<AppShell user={buildTeamMember()}><ErBoardPage /></AppShell>} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Milo" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), { target: { value: "pip" } });

    expect(screen.getByRole("heading", { name: "Pip" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Milo" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search all patients" })).toHaveAttribute("href", "/records?search=pip");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), { target: { value: "" } });

    expect(screen.getByRole("heading", { name: "Milo" })).toBeInTheDocument();
  });
});


describe("record vitals from the ER board", () => {
  it("reloads the full reviewed set and server metadata without a hub echo, keeping acuity", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy", acuity: "urgent" });
    const before = buildVitalsRecord({ heartRate: 100, respiratoryRate: 24, temperatureF: 101.5, spO2: 98,
      mucousMembraneColor: "Pink", capillaryRefillTime: "2 s", mentation: "Alert" });
    const savedReading = buildVitalsRecord({ ...before, id: "new-vitals", spO2: 91, outOfRange: ["spO2"],
      recordedAt: new Date().toISOString(), recordedBy: { id: "s1", name: "Jordan Lee" } });
    let saved = false;
    let boardReads = 0;
    let payload: unknown;
    server.use(
      http.get(apiUrl("/api/cases"), () => { boardReads++; return HttpResponse.json([buddy]); }),
      http.get(apiUrl("/api/cases/case-buddy"), () => HttpResponse.json(buildCaseDetail({
        id: buddy.id, acuity: "urgent", vitals: saved ? [savedReading, before] : [before]
      }))),
      http.post(apiUrl("/api/cases/case-buddy/vitals"), async ({ request }) => {
        payload = await request.json();
        saved = true;
        return new HttpResponse(null, { status: 201 });
      })
    );
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    expect(await screen.findByText("100 bpm")).toBeInTheDocument();
    const readsBeforeSave = boardReads;
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Record vitals" }));
    fireEvent.change(screen.getByLabelText("SpO₂ (%)"), { target: { value: "91" } });
    fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
    expect(await screen.findByText("91%")).toBeInTheDocument();
    await waitFor(() => expect(boardReads).toBeGreaterThan(readsBeforeSave));
    const latest = within(screen.getByRole("region", { name: "Latest vitals" }));
    expect(latest.queryByText("Not recorded")).not.toBeInTheDocument();
    expect(latest.queryByText("Outside range")).not.toBeInTheDocument();
    expect(latest.getByText("100 bpm")).toBeInTheDocument();
    expect(latest.getByText("24 /min")).toBeInTheDocument();
    expect(latest.getByText("38.6 °C")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clinical" }));
    const clinical = within(screen.getByRole("dialog", { name: "Clinical" }));
    const observations = within(clinical.getByRole("region", { name: "Clinical assessment" }));
    expect(observations.getAllByRole("definition").map(value => value.textContent)).toEqual(["Pink", "2 s", "Alert"]);
    expect(clinical.getByText(/^Entered/)).toHaveTextContent(/Entered .* · Jordan Lee/);
    expect(payload).toEqual({ heartRate: 100, respiratoryRate: 24, temperatureF: 101.5, spO2: 91,
      mucousMembraneColor: "Pink", capillaryRefillTime: "2 s", mentation: "Alert" });
    expect(within(await findLane("Urgent")).getByRole("button", { name: "Buddy" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Vitals recorded");
  });

  it("refreshes vitals entered from another board when caseUpdated arrives", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy", acuity: "urgent" });
    serveCases([buddy]);
    let newest = buildVitalsRecord({ heartRate: 100, spO2: 98 });
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () => HttpResponse.json(buildCaseDetail({
      id: buddy.id, acuity: "urgent", vitals: [newest]
    }))));
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    await screen.findByText("100 bpm");
    newest = buildVitalsRecord({ heartRate: 160, spO2: 94, outOfRange: ["heartRate", "spO2"] });
    hub.emit("caseUpdated", buddy.id);
    expect(await screen.findByText("160 bpm")).toBeInTheDocument();
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Latest vitals" })).queryByText("Outside range")).not.toBeInTheDocument();
    expect(within(await findLane("Urgent")).getByRole("button", { name: "Buddy" })).toHaveAttribute("aria-pressed", "true");
  });
});


describe("Clinical review on the ER board", () => {
  it("uses the selected detail without writes/duplicate reads and updates through the hub", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    let newest = buildVitalsRecord({ heartRate: 100, mentation: "Alert" });
    let detailReads = 0;
    let writes = 0;
    const rejectWrite = () => { writes++; return new HttpResponse(null, { status: 500 }); };
    server.use(
      http.get(apiUrl("/api/cases/case-buddy"), () => {
        detailReads++;
        return HttpResponse.json(buildCaseDetail({ id: buddy.id, vitals: [newest] }));
      }),
      http.post("*", rejectWrite), http.patch("*", rejectWrite), http.put("*", rejectWrite), http.delete("*", rejectWrite)
    );
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    const action = await screen.findByRole("button", { name: "Clinical" });
    const readsBeforeReview = detailReads;
    fireEvent.click(action);
    let drawer = within(screen.getByRole("dialog", { name: "Clinical" }));
    expect(drawer.getByText("100 bpm")).toBeInTheDocument();
    expect(detailReads).toBe(readsBeforeReview);
    fireEvent.click(screen.getByRole("button", { name: "Close Clinical" }));
    expect(detailReads).toBe(readsBeforeReview);
    fireEvent.click(action);
    drawer = within(screen.getByRole("dialog"));
    newest = buildVitalsRecord({ heartRate: 95, mentation: "Not assessed", recordedBy: { id: "s1", name: "Jordan Lee" } });
    hub.emit("caseUpdated", buddy.id);
    expect(await drawer.findByText("95 bpm")).toBeInTheDocument();
    expect(drawer.getByText("Not assessed")).toBeInTheDocument();
    expect(drawer.getByText(/^Entered/)).toHaveTextContent(/Jordan Lee/);
    expect(screen.getByRole("button", { name: "Close Clinical" })).toHaveFocus();
    expect(writes).toBe(0);
  });

  it("closes the drawer when the selected patient leaves the active board", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () => HttpResponse.json(buildCaseDetail({
      id: buddy.id, vitals: [buildVitalsRecord({ heartRate: 100 })]
    }))));
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    fireEvent.click(await screen.findByRole("button", { name: "Clinical" }));
    serveCases([]);
    hub.emit("caseUpdated", buddy.id);
    await screen.findByText("Select a patient on the board to see their overview.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("100 bpm")).not.toBeInTheDocument();
  });
});

describe("Timeline review on the ER board", () => {
  it("refreshes actual events, vitals entries and current tasks through the hub without review writes or duplicate reads", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    let detail = buildCaseDetail({ id: buddy.id });
    let reads = 0;
    let writes = 0;
    const rejectWrite = () => { writes++; return new HttpResponse(null, { status: 500 }); };
    server.use(
      http.get(apiUrl("/api/cases/case-buddy"), () => { reads++; return HttpResponse.json(detail); }),
      http.post("*", rejectWrite), http.patch("*", rejectWrite), http.put("*", rejectWrite), http.delete("*", rejectWrite)
    );
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    const action = await screen.findByRole("button", { name: "Timeline" });
    const readsBeforeReview = reads;
    fireEvent.click(action);
    expect(within(screen.getByRole("dialog", { name: "Timeline" })).getByText("No history recorded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Timeline" }));
    fireEvent.click(action);
    expect(reads).toBe(readsBeforeReview);
    const entered = new Date().toISOString();
    detail = { ...detail,
      timeline: [{ id: "actual-event", type: "roomChanged", description: "Moved to Treatment 2", createdAt: entered,
        createdBy: { id: "actor", name: "Event Recorder" } }],
      vitals: [buildVitalsRecord({ mentation: "Alert", recordedAt: entered, recordedBy: { id: "recorder", name: "Vitals Recorder" } })],
      tasks: [buildCaseTask({ description: "Review saved result", status: "done", resolvedAt: entered,
        resolvedBy: { id: "resolver", name: "Task Resolver" } })]
    };
    hub.emit("caseUpdated", buddy.id);
    const drawer = within(screen.getByRole("dialog", { name: "Timeline" }));
    expect(await drawer.findByText("Moved to Treatment 2")).toBeInTheDocument();
    expect(drawer.getByText("Recorded by Event Recorder")).toBeInTheDocument();
    expect(drawer.getByText("Vitals recorded")).toBeInTheDocument();
    expect(drawer.getByText("Recorded by Vitals Recorder")).toBeInTheDocument();
    expect(drawer.getByText("Task · Done")).toBeInTheDocument();
    expect(drawer.getByText("Task Resolver")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Timeline" })).toHaveFocus();
    expect(writes).toBe(0);
  });

  it("clears Timeline when the selected encounter leaves the board", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy" });
    serveCases([buddy]);
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () => HttpResponse.json(buildCaseDetail({ id: buddy.id,
      timeline: [{ id: "private-event", type: "arrived", description: "Selected encounter event", createdAt: new Date().toISOString(), createdBy: null }]
    }))));
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));
    fireEvent.click(await screen.findByRole("button", { name: "Timeline" }));
    expect(within(screen.getByRole("dialog")).getByText("Selected encounter event")).toBeInTheDocument();
    serveCases([]);
    hub.emit("caseUpdated", buddy.id);
    await screen.findByText("Select a patient on the board to see their overview.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected encounter event")).not.toBeInTheDocument();
  });
});

describe("pain-score data in the overview", () => {
  it("does not display saved pain data or offer a pain entry action", async () => {
    const buddy = buildCase({ id: "case-buddy", patientName: "Buddy", acuity: "urgent" });
    serveCases([buddy]);
    server.use(http.get(apiUrl("/api/cases/case-buddy"), () => HttpResponse.json(buildCaseDetail({
      id: buddy.id,
      acuity: "urgent",
      latestPainScore: buildPainScore({ score: 7, notes: "Existing saved assessment" })
    }))));
    renderBoard();
    fireEvent.click(await screen.findByRole("button", { name: "Buddy" }));

    await screen.findByRole("heading", { name: "Buddy" });
    expect(screen.queryByText("7 / 10")).not.toBeInTheDocument();
    expect(screen.queryByText("Existing saved assessment")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("button", { name: /pain score/i })).not.toBeInTheDocument();
  });
});
