import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, toastDuration } from "./Toast";
import { useToast } from "./toastContext";

function Trigger({ message }: { message: string }) {
  const showToast = useToast();
  return <button type="button" onClick={() => showToast(message)}>{message}</button>;
}

function renderToasts() {
  render(
    <ToastProvider>
      <Trigger message="Status updated" />
      <Trigger message="Task added" />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("announces a message, then clears it", () => {
    renderToasts();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole("button", { name: "Status updated" }));

    expect(status).toHaveTextContent("Status updated");
    expect(status).toHaveAttribute("data-show", "true");

    act(() => vi.advanceTimersByTime(toastDuration));

    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveAttribute("data-show", "false");
  });

  it("replaces the message and restarts the timer", () => {
    renderToasts();
    fireEvent.click(screen.getByRole("button", { name: "Status updated" }));
    act(() => vi.advanceTimersByTime(toastDuration - 500));

    fireEvent.click(screen.getByRole("button", { name: "Task added" }));
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByRole("status")).toHaveTextContent("Task added");
  });

  it("refuses to show a toast outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Trigger message="Lost" />)).toThrow("useToast must be used inside a ToastProvider.");
  });
});
