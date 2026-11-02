import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildCase } from "../../test/builders";
import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { PatientRow } from "./PatientRow";

const now = new Date("2026-10-28T12:00:00Z");

function showRow(overrides: Partial<EmergencyCaseListItem> = {}, onSelect = vi.fn()) {
  render(
    <table>
      <tbody>
        <PatientRow emergencyCase={buildCase(overrides)} now={now} isSelected={false} onSelect={onSelect} />
      </tbody>
    </table>
  );
  return onSelect;
}

describe("PatientRow", () => {
  it("shows the prototype's row for a case in treatment", () => {
    showRow({
      patientName: "Milo",
      species: "Dog",
      breed: "Golden Retriever",
      patientDateOfBirth: "2018-07-01",
      ownerName: "Avery Chen",
      presentingComplaint: "Hit by vehicle",
      stage: "treatment",
      stageEnteredAt: "2026-10-28T11:48:00Z",
      acuity: "critical"
    });

    expect(screen.getByRole("button", { name: "Milo" })).toBeInTheDocument();
    expect(screen.getByText("Dog · Golden Retriever · 8y")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("In treatment")).toBeInTheDocument();
    expect(screen.getByText("12 min in stage")).toBeInTheDocument();
    // Narratives stay in the panel (product rules section 3).
    expect(screen.queryByText(/Avery Chen/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hit by vehicle/)).not.toBeInTheDocument();
  });

  // A new intake's priority is provisional until triage is complete.
  it("shows an incoming case as provisional and waiting since arrival", () => {
    showRow({ stage: "incoming", acuity: "urgent", arrivalTime: "2026-10-28T11:42:00Z" });

    expect(screen.getByText("Urgent · provisional")).toBeInTheDocument();
    expect(screen.getByText("Awaiting triage")).toBeInTheDocument();
    expect(screen.getByText("Waiting 18 min")).toBeInTheDocument();
  });

  it("shows a case with no acuity as not triaged", () => {
    showRow({ acuity: null });

    expect(screen.getByText("Not triaged")).toBeInTheDocument();
  });

  it("shows the technician, then the veterinarian", () => {
    showRow({
      assignedTechnician: { id: "t1", name: "M. Bell" },
      assignedDoctor: { id: "v1", name: "J. Lee" }
    });

    const team = screen.getAllByRole("cell")[3];
    expect(team).toHaveTextContent("TechM. BellVetJ. Lee");
  });

  it("says Unassigned for each missing assignment", () => {
    showRow({ assignedTechnician: null, assignedDoctor: { id: "v1", name: "J. Lee" } });

    expect(screen.getByText("Unassigned")).toHaveAttribute("data-unassigned", "true");
    expect(screen.getAllByRole("cell")[3]).toHaveTextContent("TechUnassignedVetJ. Lee");
  });

  it("counts open blockers in words", () => {
    showRow({ blockers: [{ id: "b1", description: "Owner consent needed" }, { id: "b2", description: "Awaiting X-ray" }] });

    expect(screen.getByText("2 open blockers")).toBeInTheDocument();
    expect(screen.queryByText("Owner consent needed")).not.toBeInTheDocument();
  });

  it("selects the case once when the name is pressed", () => {
    const onSelect = showRow({ id: "case-milo", patientName: "Milo" });

    fireEvent.click(screen.getByRole("button", { name: "Milo" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("case-milo");
  });

  it("selects the case when the row is clicked", () => {
    const onSelect = showRow({ id: "case-milo", patientName: "Milo", stage: "treatment" });

    fireEvent.click(screen.getByText("In treatment"));

    expect(onSelect).toHaveBeenCalledWith("case-milo");
  });
});
