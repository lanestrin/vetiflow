import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildCase } from "../../test/builders";
import { CaseCard } from "./CaseCard";

describe("CaseCard", () => {
  it("shows the patient, complaint, acuity, status and weight", () => {
    render(
      <CaseCard
        emergencyCase={buildCase({
          patientName: "Buddy",
          species: "Dog",
          breed: "Golden Retriever",
          presentingComplaint: "Collapsed on walk",
          acuity: "critical",
          status: "inProgress",
          weightKg: 31.5
        })}
      />
    );

    expect(screen.getByRole("heading", { name: "Buddy" })).toBeInTheDocument();
    expect(screen.getByText("Dog • Golden Retriever")).toBeInTheDocument();
    expect(screen.getByText("Collapsed on walk")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("31.5 kg")).toBeInTheDocument();
  });

  it("shows only the species when the breed is unknown", () => {
    render(<CaseCard emergencyCase={buildCase({ species: "Cat", breed: null })} />);

    expect(screen.getByText("Cat")).toBeInTheDocument();
  });

  it("says when the weight has not been recorded", () => {
    render(<CaseCard emergencyCase={buildCase({ weightKg: null })} />);

    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("shows the next action only when there is one", () => {
    const { rerender } = render(
      <CaseCard emergencyCase={buildCase({ nextAction: null })} />
    );
    expect(screen.queryByText("Next:")).not.toBeInTheDocument();

    rerender(
      <CaseCard emergencyCase={buildCase({ nextAction: "Recheck lactate" })} />
    );
    expect(screen.getByText("Recheck lactate")).toBeInTheDocument();
  });
});
