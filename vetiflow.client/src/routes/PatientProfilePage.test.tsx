import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { saveAccessToken } from "../services/session";
import { apiUrl, server } from "../test/server";
import type { PatientVisit, PatientVisitHistory } from "../types/PatientVisitHistory";
import type { ErBoardRouteState } from "./ErBoardPage";
import { PatientProfilePage, type PatientProfileRouteState } from "./PatientProfilePage";

afterEach(() => {
  sessionStorage.clear();
});

function visit(overrides: Partial<PatientVisit> = {}): PatientVisit {
  return {
    caseId: "case-1",
    caseNumber: "ER-2481",
    arrivalTime: "2026-10-30T12:00:00Z",
    presentingComplaint: "Respiratory distress",
    dischargedAt: null,
    attendingDoctor: { id: "staff-1", name: "Jordan Reed" },
    ...overrides
  };
}

function history(visits: PatientVisit[], breed: string | null = "Golden Retriever"): PatientVisitHistory {
  return { patient: { id: "patient-1", name: "Milo", species: "Dog", breed }, visits };
}

function serveHistory(response: PatientVisitHistory | number) {
  server.use(
    http.get(apiUrl("/api/patients/patient-1/visits"), () =>
      typeof response === "number" ? new HttpResponse(null, { status: response }) : HttpResponse.json(response))
  );
}

function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

// Stands in for the board and shows the case it was asked to select.
function BoardStub() {
  const state = useLocation().state as ErBoardRouteState | null;
  return <p>ER board selecting {state?.selectedCaseId ?? "nothing"}</p>;
}

// Stands in for a visit record and shows which visit and router state it got.
function VisitStub() {
  const { patientId, caseId } = useParams();
  const state = useLocation().state as PatientProfileRouteState | null;
  return <p>Visit {caseId} of {patientId} from board case {state?.fromErBoard?.caseId ?? "none"}</p>;
}

function renderProfile(routeState?: PatientProfileRouteState) {
  saveAccessToken("token-team");
  render(
    <MemoryRouter initialEntries={[{ pathname: "/records/patient-1", state: routeState }]}>
      <Routes>
        <Route path="/records/:patientId" element={<PatientProfilePage />} />
        <Route path="/records" element={<p>Patients page</p>} />
        <Route path="/er" element={<BoardStub />} />
        <Route path="/records/:patientId/visits/:caseId" element={<VisitStub />} />
        <Route path="/sign-in" element={<SignInStub />} />
        <Route path="/pet-parent" element={<p>Pet parent home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PatientProfilePage", () => {
  it("shows the patient's name and breed with Visit History selected", async () => {
    serveHistory(history([visit()]));

    renderProfile();

    expect(screen.getByText("Loading the patient record…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Milo" })).toBeInTheDocument();
    expect(screen.getByText("Dog · Golden Retriever")).toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: "Patient record" });
    expect(within(tabs).getByRole("tab", { name: "Visit History" })).toHaveAttribute("aria-selected", "true");
    for (const name of ["Overview", "Documents"]) {
      const tab = within(tabs).getByRole("tab", { name });
      expect(tab).toBeDisabled();
      expect(tab).toHaveAttribute("title", "Coming soon");
    }
    expect(screen.getByRole("tabpanel", { name: "Visit History" })).toBeInTheDocument();
    expect(document.title).toBe("Milo · VetiFlow");
  });

  it("shows the species alone when no breed is recorded", async () => {
    serveHistory(history([], null));

    renderProfile();

    expect(await screen.findByText("Dog")).toBeInTheDocument();
  });

  it("lists visits in the order sent, with their status, case number and doctor", async () => {
    serveHistory(history([
      visit({ caseId: "case-2", caseNumber: "ER-2481", presentingComplaint: "Respiratory distress" }),
      visit({
        caseId: "case-1",
        caseNumber: "ER-1927",
        arrivalTime: "2026-08-12T12:00:00Z",
        presentingComplaint: "Vomiting and dehydration",
        dischargedAt: "2026-08-13T12:00:00Z",
        attendingDoctor: null
      })
    ]));

    renderProfile();

    const cards = within(await screen.findByRole("list")).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("30 Oct 2026");
    expect(cards[0]).toHaveTextContent("Respiratory distress");
    expect(cards[0]).toHaveTextContent("Active");
    expect(cards[0]).toHaveTextContent("ER visit · ER-2481 · Jordan Reed");
    expect(cards[1]).toHaveTextContent("12 Aug 2026");
    expect(cards[1]).toHaveTextContent("Discharged 13 Aug 2026");
    expect(cards[1]).toHaveTextContent("ER visit · ER-1927 · No doctor recorded");
  });

  it("opens a visit's record from its card", async () => {
    serveHistory(history([visit({ caseId: "case-7", caseNumber: "ER-2481" })]));

    renderProfile();

    expect(await screen.findByText("Select a visit to open its record.")).toBeInTheDocument();
    const card = within(screen.getByRole("listitem")).getByRole("link");
    expect(card).toHaveAccessibleName(expect.stringContaining("Respiratory distress"));
    expect(card).toHaveAccessibleName(expect.stringContaining("ER-2481"));
    fireEvent.click(card);
    expect(screen.getByText("Visit case-7 of patient-1 from board case none")).toBeInTheDocument();
  });

  it("passes the way back to the board on to a visit's record", async () => {
    serveHistory(history([visit({ caseId: "case-7" })]));

    renderProfile({ fromErBoard: { caseId: "case-1" } });

    fireEvent.click(within(await screen.findByRole("listitem")).getByRole("link"));
    expect(screen.getByText("Visit case-7 of patient-1 from board case case-1")).toBeInTheDocument();
  });

  it("says so when the patient has no visits", async () => {
    serveHistory(history([]));

    renderProfile();

    expect(await screen.findByText("No visits recorded for this patient.")).toBeInTheDocument();
  });

  it("says so when the patient does not exist", async () => {
    serveHistory(404);

    renderProfile();

    expect(await screen.findByText("This patient record could not be found.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Patient record" })).toBeInTheDocument();
  });

  it("offers to try again when the history cannot be loaded", async () => {
    serveHistory(500);

    renderProfile();

    expect(await screen.findByRole("alert")).toHaveTextContent("Visit history isn't available right now.");
    serveHistory(history([visit()]));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Milo" })).toBeInTheDocument();
  });

  it("links back to Patients", async () => {
    serveHistory(history([]));

    renderProfile();

    fireEvent.click(await screen.findByRole("link", { name: "Patients" }));
    expect(screen.getByText("Patients page")).toBeInTheDocument();
  });

  it("links back to the ER board with the same case when opened from the board", async () => {
    serveHistory(history([visit()]));

    renderProfile({ fromErBoard: { caseId: "case-1" } });

    expect(await screen.findByRole("heading", { level: 1, name: "Milo" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Patients" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "ER board" }));
    expect(screen.getByText("ER board selecting case-1")).toBeInTheDocument();
  });

  it("sends the person to sign in when the session has ended", async () => {
    serveHistory(401);

    renderProfile();

    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
  });

  it("sends a pet parent to their own home", async () => {
    serveHistory(403);

    renderProfile();

    expect(await screen.findByText("Pet parent home")).toBeInTheDocument();
  });
});
