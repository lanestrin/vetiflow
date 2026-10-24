import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseTimer } from "./CaseTimer";

const now = new Date("2026-10-24T12:00:00Z");

function minutesAgo(minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

describe("CaseTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows minutes for stays under an hour", () => {
    render(<CaseTimer arrivalTime={minutesAgo(42)} />);

    expect(screen.getByText("42 min")).toBeInTheDocument();
  });

  it("shows hours and minutes from one hour on", () => {
    render(<CaseTimer arrivalTime={minutesAgo(125)} />);

    expect(screen.getByText("2 hr 5 min")).toBeInTheDocument();
  });

  it("never shows a negative time for an arrival in the future", () => {
    render(<CaseTimer arrivalTime={minutesAgo(-5)} />);

    expect(screen.getByText("0 min")).toBeInTheDocument();
  });

  it("ticks forward every minute", () => {
    render(<CaseTimer arrivalTime={minutesAgo(59)} />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("1 hr 0 min")).toBeInTheDocument();
  });

  it("stops ticking when removed from the page", () => {
    const { unmount } = render(<CaseTimer arrivalTime={minutesAgo(1)} />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
