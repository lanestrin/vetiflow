import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { createCaseHubConnection } from "../services/caseHub";
import { readAccessToken, saveAccessToken } from "../services/session";
import { buildCase } from "../test/builders";
import { createFakeCaseHub } from "../test/fakeCaseHub";
import { apiUrl, server } from "../test/server";
import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";
import { ErBoardPage } from "./ErBoardPage";

vi.mock("../services/caseHub", () => ({
  createCaseHubConnection: vi.fn()
}));

let hub: ReturnType<typeof createFakeCaseHub>;

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
      <Routes>
        <Route path="/er" element={<ErBoardPage />} />
        <Route path="/sign-in" element={<SignInStub />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ErBoardPage", () => {
  it("sends the person to sign in when the session has ended", async () => {
    saveAccessToken("expired");
    server.use(http.get(apiUrl("/api/cases"), () => new HttpResponse(null, { status: 401 })));

    renderBoard();

    expect(await screen.findByText("Sign-in page (session ended)")).toBeInTheDocument();
    expect(readAccessToken()).toBeNull();
  });

  it("shows a loading message until the cases arrive", async () => {
    renderBoard();

    expect(screen.getByText("Loading emergency cases...")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "VetiFlow ER Board" })
    ).toBeInTheDocument();
  });

  it("names the browser tab while loading and once loaded", async () => {
    serveCases([buildCase()]);
    renderBoard();

    expect(document.title).toBe("ER Board · VetiFlow");
    await screen.findByRole("heading", { level: 1, name: "VetiFlow ER Board" });
    expect(document.title).toBe("ER Board · VetiFlow");
  });

  it("places each case in the lane for its stage", async () => {
    serveCases([
      buildCase({ patientName: "Buddy", stage: "triage" }),
      buildCase({ patientName: "Mittens", stage: "diagnostics" })
    ]);

    renderBoard();

    expect(
      within(await findLane("Triage")).getByRole("heading", { name: "Buddy" })
    ).toBeInTheDocument();
    expect(
      within(await findLane("Diagnostics")).getByRole("heading", { name: "Mittens" })
    ).toBeInTheDocument();
    expect(within(await findLane("Incoming")).getByText("No patients")).toBeInTheDocument();
  });

  // The API sorts by acuity and wait; the board must not reorder within a lane.
  it("lists a lane's cards in the order the API sent them", async () => {
    serveCases([
      buildCase({ patientName: "Rex", stage: "treatment", acuity: null }),
      buildCase({ patientName: "Bella", stage: "treatment", acuity: "critical" }),
      buildCase({ patientName: "Coco", stage: "treatment", acuity: "stable" })
    ]);

    renderBoard();

    const names = within(await findLane("Treatment"))
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["Rex", "Bella", "Coco"]);
  });

  it("shows all six workflow lanes in order", async () => {
    renderBoard();

    await findLane("Incoming");
    const lanes = screen
      .getAllByRole("region")
      .filter((region) => region.hasAttribute("data-stage"))
      .map((region) => region.getAttribute("data-stage"));

    expect(lanes).toEqual([
      "incoming",
      "triage",
      "treatment",
      "diagnostics",
      "recheck",
      "discharge"
    ]);
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
    const buddy = buildCase({ patientName: "Buddy", stage: "triage" });
    serveCases([buddy]);
    renderBoard();
    await findLane("Triage");

    serveCases([{ ...buddy, stage: "treatment" }]);
    hub.emit("caseUpdated", buddy.id);

    expect(
      await within(await findLane("Treatment")).findByRole("heading", { name: "Buddy" })
    ).toBeInTheDocument();
    expect(within(await findLane("Triage")).getByText("No patients")).toBeInTheDocument();
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
    await findLane("Incoming");

    unmount();

    expect(hub.isListening("caseUpdated")).toBe(false);
    expect(hub.connection.stop).toHaveBeenCalled();
  });
});
