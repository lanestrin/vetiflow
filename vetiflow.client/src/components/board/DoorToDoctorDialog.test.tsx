import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildBoardSummary } from "../../test/builders";
import type { BoardSummary } from "../../types/BoardSummary";
import { DoorToDoctorDialog } from "./DoorToDoctorDialog";

// jsdom has no modal dialogs; these behave like the browser's for the test.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

function summaryWith(doorToDoctor: BoardSummary["doorToDoctor"]) {
  return buildBoardSummary({ doorToDoctor });
}

function renderDialog(summary: BoardSummary, handlers = { onShowWaiting: vi.fn(), onClose: vi.fn() }) {
  render(<DoorToDoctorDialog isOpen summary={summary} {...handlers} />);
  return handlers;
}

describe("DoorToDoctorDialog", () => {
  it("compares this shift with last shift and counts the patients waiting", () => {
    renderDialog(summaryWith({
      currentShift: { averageMinutes: 14, assessed: 4 },
      previousShift: { averageMinutes: 18, assessed: 1 },
      waiting: 3
    }));

    const dialog = screen.getByRole("dialog", { name: "Door to first doctor" });
    expect(dialog).toHaveTextContent("This shift14 min average · 4 patients assessed");
    expect(dialog).toHaveTextContent("Last shift18 min average · 1 patient assessed");
    expect(screen.getByText("4 min faster than last shift")).toBeInTheDocument();
    expect(screen.getByText("3 patients waiting for a vet assessment")).toBeInTheDocument();
    expect(screen.getByText(/Arrival to the recorded vet assessment/)).toBeInTheDocument();
  });

  it("says when a shift has no assessments, with no comparison", () => {
    renderDialog(summaryWith({
      currentShift: { averageMinutes: null, assessed: 0 },
      previousShift: { averageMinutes: 18, assessed: 6 },
      waiting: 1
    }));

    expect(screen.getByRole("dialog")).toHaveTextContent("This shiftNo vet assessments recorded yet");
    expect(screen.queryByText(/than last shift|Same as last shift/)).not.toBeInTheDocument();
    expect(screen.getByText("1 patient waiting for a vet assessment")).toBeInTheDocument();
  });

  it("asks to show the waiting patients", () => {
    const { onShowWaiting } = renderDialog(buildBoardSummary());

    fireEvent.click(screen.getByRole("button", { name: "Show waiting patients" }));

    expect(onShowWaiting).toHaveBeenCalledOnce();
  });

  it("closes from Close", () => {
    const { onClose } = renderDialog(buildBoardSummary());

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
