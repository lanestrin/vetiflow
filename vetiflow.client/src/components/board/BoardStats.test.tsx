import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildBoardSummary } from "../../test/builders";
import type { BoardSummary } from "../../types/BoardSummary";
import { BoardStats, type BoardFilter } from "./BoardStats";

function showStats(summary: BoardSummary | null, filter: BoardFilter = "all", onFilter = vi.fn(), criticalWithoutVet = 2) {
  render(<BoardStats summary={summary} criticalWithoutVet={criticalWithoutVet} filter={filter} onFilter={onFilter} />);
  return onFilter;
}

function stat(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("BoardStats", () => {
  it("shows the four stats with their values", () => {
    showStats(buildBoardSummary({ patientsInCare: 12, awaitingTriage: 3, criticalPatients: 4 }));

    const strip = screen.getByRole("region", { name: "Shift summary" });
    expect(strip).toHaveTextContent("12In care3Awaiting triage4Critical2Critical without vet");
  });

  it("names each stat with its label and value", () => {
    showStats(buildBoardSummary({ patientsInCare: 12, awaitingTriage: 3, criticalPatients: 4 }));

    expect(screen.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual([
      "In care, 12",
      "Awaiting triage, 3",
      "Critical, 4",
      "Critical without vet, 2"
    ]);
  });

  it("shows dashes for the summary stats without a summary, and still counts critical without vet", () => {
    showStats(null);

    expect(stat(/^In care/)).toHaveTextContent("—");
    expect(stat(/^In care/)).toHaveAccessibleName("In care, not available");
    expect(stat(/^Awaiting triage/)).toHaveTextContent("—");
    expect(stat(/^Critical,/)).toHaveTextContent("—");
    expect(stat(/^Critical without vet/)).toHaveAccessibleName("Critical without vet, 2");
  });

  it("marks only the stat for the current filter as pressed", () => {
    showStats(buildBoardSummary(), "criticalWithoutVet");

    expect(screen.getAllByRole("button").filter(button => button.getAttribute("aria-pressed") === "true"))
      .toEqual([stat(/^Critical without vet/)]);
  });

  it("asks for each stat's filter when pressed", () => {
    const onFilter = showStats(buildBoardSummary());

    fireEvent.click(stat(/^In care/));
    fireEvent.click(stat(/^Awaiting triage/));
    fireEvent.click(stat(/^Critical,/));
    fireEvent.click(stat(/^Critical without vet/));

    expect(onFilter.mock.calls.map(([filter]) => filter)).toEqual(["all", "awaitingTriage", "critical", "criticalWithoutVet"]);
  });

  it("has no door to doctor", () => {
    showStats(buildBoardSummary());

    expect(screen.queryByText(/door to doctor/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });
});
