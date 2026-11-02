import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { saveAccessToken } from "../services/session";
import { buildCaseDetail } from "../test/builders";
import { apiUrl, server } from "../test/server";
import type { CaseDetail } from "../types/CaseDetail";
import type { PatientProfileRouteState } from "./PatientProfilePage";
import { VisitRecordPage } from "./VisitRecordPage";

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

function milo(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const base = buildCaseDetail({ id: "case-1" });
  return {
    ...base,
    caseNumber: "ER-2481",
    patient: { ...base.patient, id: "patient-1", name: "Milo", species: "Dog", breed: "Golden Retriever" },
    owner: { id: "owner-1", firstName: "Avery", lastName: "Chen", phone: "312-555-0100", email: "avery@example.test" },
    presentingComplaint: "Respiratory distress",
    acuity: "critical",
    stage: "discharge",
    arrivalTime: new Date(2026, 9, 30, 14, 5).toISOString(),
    dischargedAt: new Date(2026, 9, 30, 19, 40).toISOString(),
    assignedDoctor: { id: "staff-1", name: "Jordan Reed" },
    assignedTechnician: { id: "staff-2", name: "Sam Cruz" },
    timeline: [{ id: "e1", type: "arrived", description: "Respiratory distress", createdAt: new Date(2026, 9, 30, 14, 5).toISOString(), createdBy: null }],
    ...overrides
  };
}

function serveCase(response: CaseDetail | number) {
  server.use(
    http.get(apiUrl("/api/cases/case-1"), () =>
      typeof response === "number" ? new HttpResponse(null, { status: response }) : HttpResponse.json(response))
  );
}

function SignInStub() {
  const state = useLocation().state as SignInRouteState | null;
  return <p>Sign-in page{state?.sessionEnded ? " (session ended)" : ""}</p>;
}

// Stands in for the profile and shows the router state it received.
function ProfileStub() {
  const state = useLocation().state as PatientProfileRouteState | null;
  return <p>Profile from board case {state?.fromErBoard?.caseId ?? "none"}</p>;
}

function renderRecord(routeState?: PatientProfileRouteState) {
  saveAccessToken("token-team");
  render(
    <MemoryRouter initialEntries={[{ pathname: "/records/patient-1/visits/case-1", state: routeState }]}>
      <Routes>
        <Route path="/records/:patientId/visits/:caseId" element={<VisitRecordPage />} />
        <Route path="/records/:patientId" element={<ProfileStub />} />
        <Route path="/sign-in" element={<SignInStub />} />
        <Route path="/pet-parent" element={<p>Pet parent home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function summaryValue(term: string) {
  const summary = within(screen.getByRole("region", { name: "Visit summary" }));
  return summary.getByText(term).nextElementSibling?.textContent;
}

describe("VisitRecordPage", () => {
  it("shows a discharged visit's summary with its case number and date", async () => {
    serveCase(milo());

    renderRecord();

    expect(await screen.findByRole("heading", { level: 1, name: "ER visit · ER-2481" })).toBeInTheDocument();
    expect(screen.getByText("Milo · Dog · Golden Retriever · Arrived 30 Oct 2026, 2:05 PM")).toBeInTheDocument();
    expect(summaryValue("Reason")).toBe("Respiratory distress");
    expect(summaryValue("Acuity")).toMatch(/Critical/);
    expect(summaryValue("Outcome")).toBe("Discharged 30 Oct 2026, 7:40 PM");
    expect(summaryValue("Attending veterinarian")).toBe("Jordan Reed");
    expect(summaryValue("Primary technician")).toBe("Sam Cruz");
    expect(summaryValue("Arrived")).toBe("30 Oct 2026, 2:05 PM");
    expect(summaryValue("Discharged")).toBe("30 Oct 2026, 7:40 PM");
    expect(document.title).toBe("ER-2481 · Milo · VetiFlow");
  });

  it("shows an active visit and missing values honestly", async () => {
    serveCase(milo({
      presentingComplaint: " ",
      acuity: null,
      stage: "incoming",
      dischargedAt: null,
      assignedDoctor: null,
      assignedTechnician: null
    }));

    renderRecord();

    await screen.findByRole("heading", { level: 1 });
    expect(summaryValue("Reason")).toBe("Not recorded");
    expect(summaryValue("Acuity")).toMatch(/Not triaged/);
    expect(summaryValue("Outcome")).toBe("Active – still on the ER board");
    expect(summaryValue("Attending veterinarian")).toBe("Unassigned");
    expect(summaryValue("Primary technician")).toBe("Not assigned");
    expect(summaryValue("Discharged")).toBe("Not discharged");
  });

  it("is read-only: only the Clinical and Timeline reviews, and no owner details", async () => {
    serveCase(milo());

    renderRecord();

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(["Clinical", "Timeline"]);
    expect(screen.queryByText(/Avery|312-555-0100|avery@example\.test/)).not.toBeInTheDocument();
  });

  it.each(["Clinical", "Timeline"])("opens the %s review for this visit", async (name) => {
    serveCase(milo());

    renderRecord();

    fireEvent.click(await screen.findByRole("button", { name }));
    const dialog = screen.getByRole("dialog", { name });
    expect(dialog).toHaveAccessibleDescription("Milo · Case ER-2481 · 30 Oct 2026");

    fireEvent.click(within(dialog).getByRole("button", { name: `Close ${name}` }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name })).toHaveFocus();
  });

  it("treats another patient's case as not found", async () => {
    const other = milo();
    serveCase({ ...other, patient: { ...other.patient, id: "patient-2", name: "Luna" } });

    renderRecord();

    expect(await screen.findByText("This visit record could not be found.")).toBeInTheDocument();
    expect(screen.queryByText(/Luna/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ER-2481/)).not.toBeInTheDocument();
  });

  it("says so when the visit does not exist", async () => {
    serveCase(404);

    renderRecord();

    expect(await screen.findByText("This visit record could not be found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patient record" })).toBeInTheDocument();
  });

  it("offers a retry when the record cannot load", async () => {
    let requests = 0;
    server.use(http.get(apiUrl("/api/cases/case-1"), () => {
      requests += 1;
      return requests === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(milo());
    }));

    renderRecord();

    expect(await screen.findByRole("alert")).toHaveTextContent("This visit record isn't available right now. Try again in a moment.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "ER visit · ER-2481" })).toBeInTheDocument();
  });

  it("sends the person to sign in when the session has ended", async () => {
    serveCase(401);

    renderRecord();

    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
  });

  it("sends a pet parent to their own page", async () => {
    serveCase(403);

    renderRecord();

    expect(await screen.findByText("Pet parent home")).toBeInTheDocument();
  });

  it("links back to the patient and keeps the way back to the board", async () => {
    serveCase(milo());

    renderRecord({ fromErBoard: { caseId: "case-1" } });

    fireEvent.click(await screen.findByRole("link", { name: "Milo" }));
    expect(screen.getByText("Profile from board case case-1")).toBeInTheDocument();
  });
});
