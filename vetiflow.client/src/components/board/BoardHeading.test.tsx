import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildBoardSummary } from "../../test/builders";
import { BoardHeading } from "./BoardHeading";

// The Demo role row's props (2.28), the Veterinarian view.
const demoProps = { demoRole: "veterinarian" as const, demoIdentity: "J. Lee", onDemoRoleChange: vi.fn() };

describe("BoardHeading", () => {
  it("shows the clinic, title, shift status and New intake without a subtitle", () => {
    render(
      <BoardHeading
        summary={buildBoardSummary({ clinicName: "Northside Veterinary Emergency", cliniciansOnFloor: 4 })}
        onIntake={vi.fn()}
        {...demoProps}
      />
    );

    expect(screen.getByText("Northside Veterinary Emergency")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Northside Veterinary Emergency" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "ER Command Center" })).toBeInTheDocument();
    expect(screen.queryByText("Live patient flow and care coordination")).not.toBeInTheDocument();
    expect(screen.getByText("Day shift · 4 clinicians on floor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New intake" })).toBeInTheDocument();
  });

  it("leaves out the clinic and chip while the summary is unavailable", () => {
    render(<BoardHeading summary={null} onIntake={vi.fn()} {...demoProps} />);

    expect(screen.getByRole("heading", { level: 1, name: "ER Command Center" })).toBeInTheDocument();
    expect(screen.queryByText("Northside Veterinary Emergency")).not.toBeInTheDocument();
    expect(screen.queryByText(/on floor/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New intake" })).toBeInTheDocument();
  });

  it("asks for the intake dialog from New intake", () => {
    const onIntake = vi.fn();
    render(<BoardHeading summary={null} onIntake={onIntake} {...demoProps} />);

    fireEvent.click(screen.getByRole("button", { name: "New intake" }));

    expect(onIntake).toHaveBeenCalledOnce();
  });
});
