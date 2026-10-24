import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseStatusLabel } from "./CaseStatusLabel";

describe("CaseStatusLabel", () => {
  it.each([
    ["unassigned", "Unassigned"],
    ["assigned", "Assigned"],
    ["waiting", "Waiting"],
    ["inProgress", "In Progress"],
    ["blocked", "Blocked"],
    ["readyForNextStep", "Ready for Next Step"],
    ["completed", "Completed"]
  ] as const)("labels %s as %s", (status, label) => {
    render(<CaseStatusLabel status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
