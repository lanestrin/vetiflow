import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildBoardSummary } from "../../test/builders";
import { BoardHeading } from "./BoardHeading";

describe("BoardHeading", () => {
  it("shows the clinic, title, subtitle and shift chip from the summary", () => {
    render(
      <BoardHeading
        summary={buildBoardSummary({ clinicName: "Northside Veterinary Emergency", cliniciansOnFloor: 4 })}
        onIntake={vi.fn()}
      />
    );

    expect(screen.getByText("Northside Veterinary Emergency")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Northside Veterinary Emergency" })).toBeInTheDocument();
    expect(screen.queryByText("ER Command Center")).not.toBeInTheDocument();
    expect(screen.getByText("Live patient flow and care coordination")).toBeInTheDocument();
    expect(screen.getByText("Day shift · 4 clinicians on floor")).toBeInTheDocument();
  });

  it("leaves out the clinic and chip while the summary is unavailable", () => {
    render(<BoardHeading summary={null} onIntake={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Emergency board" })).toBeInTheDocument();
    expect(screen.queryByText("Northside Veterinary Emergency")).not.toBeInTheDocument();
    expect(screen.queryByText(/on floor/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New intake" })).toBeInTheDocument();
  });

  it("asks for the intake dialog from New intake", () => {
    const onIntake = vi.fn();
    render(<BoardHeading summary={null} onIntake={onIntake} />);

    fireEvent.click(screen.getByRole("button", { name: "New intake" }));

    expect(onIntake).toHaveBeenCalledOnce();
  });
});
