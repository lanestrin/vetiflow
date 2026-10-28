import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcuityBadge } from "./AcuityBadge";

describe("AcuityBadge", () => {
  it.each([
    ["critical", "Critical"],
    ["urgent", "Urgent"],
    ["stable", "Stable"]
  ] as const)("labels %s acuity as %s", (acuity, label) => {
    render(<AcuityBadge acuity={acuity} />);

    expect(screen.getByText(label)).toHaveAttribute("data-acuity", acuity);
  });

  it("marks an intake's priority as provisional", () => {
    render(<AcuityBadge acuity="urgent" isProvisional />);

    expect(screen.getByText("Urgent · provisional")).toHaveAttribute("data-acuity", "urgent");
  });

  it("shows that an untriaged patient has no acuity yet", () => {
    render(<AcuityBadge acuity={null} />);

    expect(screen.getByText("Not triaged")).not.toHaveAttribute("data-acuity");
  });
});
