import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCaseHubConnection } from "../services/caseHub";
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

function serveCases(cases: EmergencyCaseListItem[]) {
  server.use(http.get(apiUrl("/api/cases"), () => HttpResponse.json(cases)));
}

async function findLane(name: string) {
  return screen.findByRole("region", { name });
}

describe("ErBoardPage", () => {
  it("shows a loading message until the cases arrive", async () => {
    render(<ErBoardPage />);

    expect(screen.getByText("Loading emergency cases...")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "VetiFlow ER Board" })
    ).toBeInTheDocument();
  });

  it("places each case in the lane for its stage", async () => {
    serveCases([
      buildCase({ patientName: "Buddy", stage: "triage" }),
      buildCase({ patientName: "Mittens", stage: "diagnostics" })
    ]);

    render(<ErBoardPage />);

    expect(
      within(await findLane("Triage")).getByRole("heading", { name: "Buddy" })
    ).toBeInTheDocument();
    expect(
      within(await findLane("Diagnostics")).getByRole("heading", { name: "Mittens" })
    ).toBeInTheDocument();
    expect(within(await findLane("Incoming")).getByText("No patients")).toBeInTheDocument();
  });

  it("shows all six workflow lanes in order", async () => {
    render(<ErBoardPage />);

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

    render(<ErBoardPage />);

    expect(
      await screen.findByText("Unable to load emergency cases.")
    ).toBeInTheDocument();
  });

  it("reloads the board when the server reports a case update", async () => {
    const buddy = buildCase({ patientName: "Buddy", stage: "triage" });
    serveCases([buddy]);
    render(<ErBoardPage />);
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

    render(<ErBoardPage />);

    expect(await screen.findByRole("heading", { name: "Buddy" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to connect to live case updates.",
      expect.any(Error)
    );
  });

  it("disconnects from live updates when the page closes", async () => {
    const { unmount } = render(<ErBoardPage />);
    await findLane("Incoming");

    unmount();

    expect(hub.isListening("caseUpdated")).toBe(false);
    expect(hub.connection.stop).toHaveBeenCalled();
  });
});
