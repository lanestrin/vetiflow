import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildCase } from "../../test/builders";
import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { PatientFlowBoard } from "./PatientFlowBoard";

function renderBoard(cases: EmergencyCaseListItem[], updatedAt = new Date()) {
  render(
    <PatientFlowBoard cases={cases} updatedAt={updatedAt} selectedCaseId={null} onSelect={vi.fn()} />
  );
}

function lane(name: string) {
  return screen.getByRole("region", { name });
}

describe("PatientFlowBoard", () => {
  it("counts the cases in each acuity lane", () => {
    renderBoard([
      buildCase({ acuity: "critical" }),
      buildCase({ acuity: "urgent" }),
      buildCase({ acuity: "urgent" })
    ]);

    expect(within(lane("Critical")).getByText("1")).toBeInTheDocument();
    expect(within(lane("Urgent")).getByText("2")).toBeInTheDocument();
    expect(within(lane("Stable")).getByText("0")).toBeInTheDocument();
    expect(within(lane("Stable")).getByText("No patients")).toBeInTheDocument();
  });

  it("says when it was updated and how many cases are active", () => {
    renderBoard([buildCase(), buildCase()]);

    expect(screen.getByRole("heading", { level: 2, name: "Patient flow" })).toBeInTheDocument();
    expect(screen.getByText(/Updated just now/)).toHaveTextContent("Updated just now·2 active cases");
    expect(screen.getByText("Showing 2 of 2 active cases")).toBeInTheDocument();
  });

  it("says how long ago it was updated", () => {
    renderBoard([buildCase()], new Date(Date.now() - 5 * 60_000));

    expect(screen.getByText(/Updated 5 min ago/)).toBeInTheDocument();
  });

  // Only old data has no acuity; such cases must not disappear.
  it("adds a Not triaged lane only when a case has no acuity", () => {
    renderBoard([buildCase({ patientName: "Rex", acuity: null })]);

    expect(within(lane("Not triaged")).getByRole("heading", { name: "Rex" })).toBeInTheDocument();
  });

  it("has no Not triaged lane when every case has an acuity", () => {
    renderBoard([buildCase({ acuity: "stable" })]);

    expect(screen.queryByRole("region", { name: "Not triaged" })).not.toBeInTheDocument();
  });

  it("switches the lane shown at phone width with the lane tabs", () => {
    renderBoard([buildCase({ acuity: "critical" })]);
    const tabs = screen.getByRole("group", { name: "Show lane" });

    expect(within(tabs).getByRole("button", { name: "Critical" })).toHaveAttribute("aria-pressed", "true");
    expect(lane("Critical")).toHaveAttribute("data-shown", "true");

    fireEvent.click(within(tabs).getByRole("button", { name: "Stable" }));

    expect(lane("Stable")).toHaveAttribute("data-shown", "true");
    expect(lane("Critical")).toHaveAttribute("data-shown", "false");
  });
});
