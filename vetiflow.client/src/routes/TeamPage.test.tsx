import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseHubConnection } from "../services/caseHub";
import { saveAccessToken } from "../services/session";
import { createFakeCaseHub } from "../test/fakeCaseHub";
import { apiUrl, server } from "../test/server";
import type { TeamClinician } from "../types/Team";
import { TeamPage } from "./TeamPage";

vi.mock("../services/caseHub", () => ({
  createCaseHubConnection: vi.fn()
}));

let hub: ReturnType<typeof createFakeCaseHub>;

beforeEach(() => {
  hub = createFakeCaseHub();
  vi.mocked(createCaseHubConnection).mockReturnValue(hub.asHubConnection());
  saveAccessToken("token-team");
});

afterEach(() => {
  sessionStorage.clear();
});

function clinician(overrides: Partial<TeamClinician>): TeamClinician {
  return {
    id: "s1",
    displayName: "Dr. Jordan Lee",
    initials: "JL",
    role: "veterinarian",
    status: "available",
    activeCaseCount: 0,
    activeCases: [],
    ...overrides
  };
}

function serveTeam(team: TeamClinician[]) {
  server.use(http.get(apiUrl("/api/staff/team"), () => HttpResponse.json(team)));
}

function renderTeam() {
  render(
    <MemoryRouter initialEntries={["/team"]}>
      <Routes>
        <Route path="/team" element={<TeamPage />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
        <Route path="/pet-parent" element={<p>Pet parent home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TeamPage", () => {
  it("shows the clinicians on the floor before the unavailable ones, each with status and cases", async () => {
    serveTeam([
      clinician({
        id: "unavailable",
        displayName: "Dr. Aaron Away",
        initials: "AA",
        status: "unavailable",
        activeCaseCount: 0
      }),
      clinician({
        id: "floor",
        displayName: "Tom Helper",
        initials: "TH",
        role: "technician",
        status: "busy",
        activeCaseCount: 2,
        activeCases: [
          { id: "c1", caseNumber: "ER-2481", patientName: "Milo" },
          { id: "c2", caseNumber: "ER-2482", patientName: "Luna" }
        ]
      })
    ]);

    renderTeam();

    expect(await screen.findByRole("heading", { level: 1, name: "Team" })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["On the floor 1", "Unavailable 1"]);
    const onFloor = screen.getByRole("region", { name: /On the floor/ });
    expect(within(onFloor).getByText("Tom Helper")).toBeInTheDocument();
    expect(within(onFloor).getByText("Technician")).toBeInTheDocument();
    expect(within(onFloor).getByText("Busy")).toBeInTheDocument();
    expect(within(onFloor).getByText("2 active cases")).toBeInTheDocument();
    const cases = within(onFloor).getByRole("list", { name: "Active cases for Tom Helper" });
    expect(within(cases).getByText("ER-2481 · Milo")).toBeInTheDocument();
    expect(within(cases).getByText("ER-2482 · Luna")).toBeInTheDocument();
    const unavailable = screen.getByRole("region", { name: /Unavailable/ });
    expect(within(unavailable).getByText("Dr. Aaron Away")).toBeInTheDocument();
    expect(within(within(unavailable).getByRole("listitem")).getByText("Unavailable")).toBeInTheDocument();
  });

  it("says a clinician with no cases has none, and a group with nobody says so", async () => {
    serveTeam([clinician({ displayName: "Dr. Ina Idle", status: "available" })]);

    renderTeam();

    const onFloor = await screen.findByRole("region", { name: /On the floor/ });
    expect(within(onFloor).getByText("Dr. Ina Idle")).toBeInTheDocument();
    expect(within(onFloor).getByText("0 active cases")).toBeInTheDocument();
    expect(within(onFloor).getByText("No active cases")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /Unavailable/ })).getByText("No one is unavailable"))
      .toBeInTheDocument();
  });

  it("shows an empty state when no clinicians are recorded", async () => {
    serveTeam([]);

    renderTeam();

    expect(await screen.findByText("No clinicians recorded")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /On the floor/ })).not.toBeInTheDocument();
  });

  it("shows an error with Try again, and loads the team when it is pressed", async () => {
    let attempts = 0;
    server.use(http.get(apiUrl("/api/staff/team"), () => {
      attempts += 1;
      return attempts === 1
        ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json([clinician({ displayName: "Dr. Recovered Vet" })]);
    }));

    renderTeam();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the team.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Dr. Recovered Vet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends a visitor whose session has ended to sign in", async () => {
    server.use(http.get(apiUrl("/api/staff/team"), () => new HttpResponse(null, { status: 401 })));

    renderTeam();

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("sends a pet parent to their home", async () => {
    server.use(http.get(apiUrl("/api/staff/team"), () => new HttpResponse(null, { status: 403 })));

    renderTeam();

    expect(await screen.findByText("Pet parent home")).toBeInTheDocument();
  });

  it("reloads the team when a case changes", async () => {
    let caseCount = 0;
    server.use(http.get(apiUrl("/api/staff/team"), () => HttpResponse.json([clinician({
      displayName: "Dr. Jordan Lee",
      activeCaseCount: caseCount,
      activeCases: caseCount === 1 ? [{ id: "c1", caseNumber: "ER-2481", patientName: "Milo" }] : []
    })])));

    renderTeam();
    expect(await screen.findByText("0 active cases")).toBeInTheDocument();

    caseCount = 1;
    hub.emit("caseUpdated", "case-milo");

    expect(await screen.findByText("1 active case")).toBeInTheDocument();
    expect(screen.getByText("ER-2481 · Milo")).toBeInTheDocument();
  });
});
