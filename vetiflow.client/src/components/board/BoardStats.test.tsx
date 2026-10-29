import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildBoardSummary } from "../../test/builders";
import type { BoardSummary } from "../../types/BoardSummary";
import { BoardStats, type BoardFilter } from "./BoardStats";

const now = new Date("2026-10-28T15:00:00Z");

function showStats(summary: BoardSummary | null, filter: BoardFilter = "all", onFilter = vi.fn()) {
  render(<BoardStats summary={summary} filter={filter} now={now} onFilter={onFilter} />);
  return onFilter;
}

function card(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("BoardStats", () => {
  it("shows patients in care and the arrivals since the shift began", () => {
    const shiftStart = "2026-10-28T13:00:00Z";
    showStats(buildBoardSummary({
      patientsInCare: 12,
      arrivedThisShift: 3,
      shift: { name: "day", startedAt: shiftStart }
    }));

    const expectedTime = new Date(shiftStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    expect(card(/patients in care/i)).toHaveTextContent("12");
    expect(card(/patients in care/i)).toHaveTextContent(`+3 since ${expectedTime}`);
  });

  it("shows the triage queue and its oldest wait in minutes", () => {
    showStats(buildBoardSummary({
      awaitingTriage: 3,
      oldestAwaitingTriageArrivedAt: "2026-10-28T14:42:00Z"
    }));

    expect(card(/awaiting triage/i)).toHaveTextContent("3");
    expect(card(/awaiting triage/i)).toHaveTextContent("Click to view incoming cases · oldest wait 18 min");
  });

  it("says when nobody awaits triage", () => {
    showStats(buildBoardSummary({ awaitingTriage: 0, oldestAwaitingTriageArrivedAt: null }));

    expect(card(/awaiting triage/i)).toHaveTextContent("No patients awaiting triage");
  });

  it.each([
    [0, 0, "No critical patients"],
    [1, 0, "Assigned to a care team"],
    [2, 0, "Both assigned to a care team"],
    [3, 0, "All assigned to a care team"],
    [3, 2, "2 without a care team"]
  ])("with %i critical and %i without a team, says \"%s\"", (critical, withoutTeam, foot) => {
    showStats(buildBoardSummary({ criticalPatients: critical, criticalWithoutCareTeam: withoutTeam }));

    expect(card(/critical patients/i)).toHaveTextContent(`${critical}`);
    expect(card(/critical patients/i)).toHaveTextContent(foot);
  });

  it("shows door to doctor as a dash, not a button, until 2.16b", () => {
    showStats(buildBoardSummary());

    expect(screen.queryByRole("button", { name: /door to doctor/i })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Avg. door to doctor" })).toHaveTextContent("—");
  });

  it("shows dashes and Not available without a summary", () => {
    showStats(null);

    for (const name of [/patients in care/i, /awaiting triage/i, /critical patients/i]) {
      expect(card(name)).toHaveTextContent("—");
      expect(card(name)).toHaveTextContent("Not available");
    }
  });

  it("marks only the card for the current filter as pressed", () => {
    showStats(buildBoardSummary(), "critical");

    expect(card(/critical patients/i)).toHaveAttribute("aria-pressed", "true");
    expect(card(/critical patients/i)).toHaveTextContent("Active");
    expect(card(/patients in care/i)).toHaveAttribute("aria-pressed", "false");
    expect(card(/awaiting triage/i)).toHaveAttribute("aria-pressed", "false");
  });

  it("asks for each card's filter when pressed", () => {
    const onFilter = showStats(buildBoardSummary());

    fireEvent.click(card(/awaiting triage/i));
    fireEvent.click(card(/critical patients/i));
    fireEvent.click(card(/patients in care/i));

    expect(onFilter.mock.calls).toEqual([["awaitingTriage"], ["critical"], ["all"]]);
  });
});
