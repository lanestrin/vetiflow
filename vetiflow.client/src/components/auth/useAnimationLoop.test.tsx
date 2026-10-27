import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnimationLoop } from "./useAnimationLoop";

function Loop({ onFrame, isRunning }: { onFrame: (seconds: number) => void; isRunning: boolean }) {
  useAnimationLoop(onFrame, isRunning);
  return null;
}

describe("useAnimationLoop", () => {
  let callbacks: FrameRequestCallback[];

  beforeEach(() => {
    callbacks = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for no frames when it should stand still", () => {
    render(<Loop onFrame={vi.fn()} isRunning={false} />);

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("calls back with the seconds since it started", () => {
    const onFrame = vi.fn();
    render(<Loop onFrame={onFrame} isRunning />);

    callbacks[0](1000);
    callbacks[1](2500);

    expect(onFrame).toHaveBeenNthCalledWith(1, 0);
    expect(onFrame).toHaveBeenNthCalledWith(2, 1.5);
  });

  it("cancels its frame when the page goes away", () => {
    const { unmount } = render(<Loop onFrame={vi.fn()} isRunning />);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
