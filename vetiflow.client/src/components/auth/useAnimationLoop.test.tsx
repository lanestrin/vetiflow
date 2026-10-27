import { act, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnimationLoop } from "./useAnimationLoop";

function Loop({ onFrame, isRunning }: { onFrame: (seconds: number) => void; isRunning: boolean }) {
  useAnimationLoop(onFrame, isRunning);
  return null;
}

// Watches its own element, as SignInScene does.
function WatchedLoop({ onFrame }: { onFrame: (seconds: number) => void }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useAnimationLoop(onFrame, true, element);
  return <div ref={setElement} />;
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

  it("pauses while the element is off screen", () => {
    let report: (isOnScreen: boolean) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          report = (isOnScreen) =>
            callback([{ isIntersecting: isOnScreen } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
        }
        observe() {}
        disconnect() {}
      }
    );
    render(<WatchedLoop onFrame={vi.fn()} />);
    const framesBefore = vi.mocked(window.requestAnimationFrame).mock.calls.length;

    act(() => report(false));
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(framesBefore);

    act(() => report(true));
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(framesBefore + 1);
  });
});
