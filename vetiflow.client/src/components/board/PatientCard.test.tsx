import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildCase } from "../../test/builders";
import type { CaseTag, CaseTagTone } from "../../types/CaseTag";
import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { PatientCard } from "./PatientCard";

const now = new Date("2026-10-28T12:00:00Z");

function showCard(overrides: Partial<EmergencyCaseListItem> = {}, onSelect = vi.fn()) {
  render(
    <PatientCard
      emergencyCase={buildCase(overrides)}
      now={now}
      isSelected={false}
      onSelect={onSelect}
    />
  );
  return onSelect;
}

function caseTag(id: string, text: string, tone: CaseTagTone): CaseTag {
  return { id, text, tone, createdAt: "2026-10-28T11:00:00Z", createdBy: null };
}

describe("PatientCard", () => {
  it("shows the prototype's card for a case in treatment", () => {
    showCard({
      patientName: "Milo",
      species: "Dog",
      breed: "Golden Retriever",
      patientDateOfBirth: "2018-07-01",
      ownerName: "Avery Chen",
      presentingComplaint: "Hit by vehicle",
      stage: "treatment",
      stageEnteredAt: "2026-10-28T11:48:00Z",
      acuity: "critical",
      waitChip: "stat",
      clinician: { id: "s1", shortName: "Reed", initials: "JR" }
    });

    expect(screen.getByRole("heading", { level: 4, name: "Milo" })).toBeInTheDocument();
    expect(screen.getByText("Dog · Golden Retriever · 8y")).toBeInTheDocument();
    expect(screen.getByText("STAT")).toBeInTheDocument();
    expect(screen.getByText("Avery Chen · Hit by vehicle")).toBeInTheDocument();
    expect(screen.getByText("In treatment · 12 min")).toBeInTheDocument();
    expect(screen.getByText("JR")).toBeInTheDocument();
    expect(screen.getByText("Reed")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tags" })).not.toBeInTheDocument();
  });

  it("counts minutes since arrival on the wait chip", () => {
    showCard({ waitChip: "minutes", arrivalTime: "2026-10-28T11:42:00Z" });

    expect(screen.getByText("18 min")).toBeInTheDocument();
  });

  // A new intake's priority is provisional until triage is complete.
  it("shows an incoming case as New, provisional and awaiting triage", () => {
    showCard({ stage: "incoming", acuity: "urgent", waitChip: "new", clinician: null });

    expect(screen.getByText("New")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Tags" })).getByText("Urgent · provisional"))
      .toHaveAttribute("data-tone", "urgent");
    expect(screen.getByText("Awaiting triage")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("shows case tags in their tones, between the provisional chip and the blockers", () => {
    showCard({
      stage: "incoming",
      acuity: "urgent",
      tags: [
        caseTag("t1", "O2 support", "caution"),
        caseTag("t2", "Fresh wound", "alert"),
        caseTag("t3", "Vet notes", "info"),
        caseTag("t4", "Feeding", "neutral")
      ],
      blockers: [{ id: "b1", description: "Owner consent needed" }]
    });

    const items = within(screen.getByRole("list", { name: "Tags" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Urgent · provisional",
      "O2 support",
      "Fresh wound",
      "Vet notes",
      "Feeding",
      "Owner consent needed"
    ]);
    expect(screen.getByText("O2 support")).toHaveAttribute("data-tone", "caution");
    expect(screen.getByText("Fresh wound")).toHaveAttribute("data-tone", "alert");
    expect(screen.getByText("Vet notes")).toHaveAttribute("data-tone", "info");
    expect(screen.getByText("Feeding")).toHaveAttribute("data-tone", "neutral");
  });

  it("shows the tag list for a case with tags and no chip or blockers", () => {
    showCard({ stage: "treatment", acuity: "stable", tags: [caseTag("t1", "O2 support", "caution")] });

    expect(within(screen.getByRole("list", { name: "Tags" })).getByText("O2 support")).toBeInTheDocument();
  });

  it("shows open blockers as alert tags", () => {
    showCard({ blockers: [{ id: "b1", description: "Owner consent needed" }] });

    expect(screen.getByText("Owner consent needed")).toHaveAttribute("data-tone", "critical");
  });

  it("shows the complaint alone when the patient has no owner, and no age when unknown", () => {
    showCard({ ownerName: null, presentingComplaint: "Stray, limping", breed: null, patientDateOfBirth: null });

    expect(screen.getByText("Stray, limping")).toBeInTheDocument();
    expect(screen.getByText("Dog")).toBeInTheDocument();
  });

  it("selects the case when pressed", () => {
    const onSelect = showCard({ id: "case-milo", patientName: "Milo" });

    fireEvent.click(screen.getByRole("button", { name: "Milo" }));

    expect(onSelect).toHaveBeenCalledWith("case-milo");
  });
});
