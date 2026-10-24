import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildCase } from "../../test/builders";
import { WorkflowLane } from "./WorkflowLane";

describe("WorkflowLane", () => {
  it("lists a card for each case with the lane's count", () => {
    render(
      <WorkflowLane
        title="Triage"
        stage="triage"
        cases={[
          buildCase({ patientName: "Buddy" }),
          buildCase({ patientName: "Mittens" })
        ]}
      />
    );

    const lane = screen.getByRole("region", { name: "Triage" });
    expect(within(lane).getByText("2")).toBeInTheDocument();
    expect(within(lane).getAllByRole("article")).toHaveLength(2);
    expect(within(lane).getByRole("heading", { name: "Buddy" })).toBeInTheDocument();
    expect(within(lane).getByRole("heading", { name: "Mittens" })).toBeInTheDocument();
  });

  it("says the lane is empty when there are no cases", () => {
    render(<WorkflowLane title="Recheck" stage="recheck" cases={[]} />);

    const lane = screen.getByRole("region", { name: "Recheck" });
    expect(within(lane).getByText("No patients")).toBeInTheDocument();
    expect(within(lane).getByText("0")).toBeInTheDocument();
  });
});
