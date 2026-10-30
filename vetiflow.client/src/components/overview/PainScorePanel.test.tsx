import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PainScore } from "../../types/CaseDetail";
import { PainScorePanel } from "./PainScorePanel";

const now = new Date(2026, 9, 29, 12, 0);
const recorded: PainScore = {
  id: "pain-1",
  score: 7,
  notes: null,
  recordedAt: new Date(2026, 9, 29, 11, 15).toISOString(),
  recordedBy: { id: "staff-1", name: "Jordan Lee" }
};

describe("PainScorePanel", () => {
  it("distinguishes no score from zero and leaves recording disabled", () => {
    render(<PainScorePanel score={null} now={now} />);

    expect(screen.getByRole("region", { name: "Pain score" })).toHaveTextContent("Not recorded");
    expect(screen.getByText("Use the clinic's approved species-specific scale.")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText("0 / 10")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "＋ Record score" })).toBeDisabled();
  });

  it.each([0, 7, 10])("shows recorded score %i with its accessible meter value", (score) => {
    render(<PainScorePanel score={{ ...recorded, score }} now={now} />);

    expect(screen.getByText(`${score} / 10`)).toBeInTheDocument();
    const meter = screen.getByRole("meter", { name: "Pain score" });
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "10");
    expect(meter).toHaveAttribute("aria-valuenow", String(score));
    expect(meter).toHaveAttribute("aria-valuetext", `${score} out of 10`);
    expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();
  });

  it("shows when and who recorded the score", () => {
    render(<PainScorePanel score={recorded} now={now} />);

    expect(screen.getByText("Recorded 11:15 AM · Jordan Lee")).toBeInTheDocument();
  });

  it("adds the date for an older score and omits an absent recorder", () => {
    render(<PainScorePanel score={{
      ...recorded, recordedBy: null, recordedAt: new Date(2026, 9, 28, 22, 15).toISOString()
    }} now={now} />);

    expect(screen.getByText("Recorded 28 Oct, 10:15 PM")).toBeInTheDocument();
    expect(screen.queryByText(/Jordan Lee/)).not.toBeInTheDocument();
  });

  it("renders clinical notes as literal text", () => {
    const notes = '<img src=x onerror="alert(1)"> Patient is restless.';
    render(<PainScorePanel score={{ ...recorded, notes }} now={now} />);

    expect(screen.getByText(notes)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("replaces the meter and notes when the score becomes missing", () => {
    const view = render(<PainScorePanel score={{ ...recorded, notes: "Restless" }} now={now} />);

    view.rerender(<PainScorePanel score={null} now={now} />);

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText("Restless")).not.toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });
});
