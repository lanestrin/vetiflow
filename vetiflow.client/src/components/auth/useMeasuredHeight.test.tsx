import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMeasuredHeight } from "./useMeasuredHeight";

function Measured() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const height = useMeasuredHeight(element);
  return <div ref={setElement}>{height === undefined ? "natural" : `${height}px`}</div>;
}

// A stand-in for the browser's ResizeObserver that lets the test report sizes.
function stubResizeObserver() {
  const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];

  class FakeResizeObserver {
    disconnect = vi.fn();
    constructor(callback: ResizeObserverCallback) {
      observers.push({ callback, disconnect: this.disconnect });
    }
    observe() {}
    unobserve() {}
  }

  vi.stubGlobal("ResizeObserver", FakeResizeObserver);

  const report = (height: number) =>
    act(() => {
      observers[0].callback([{ contentRect: { height } } as ResizeObserverEntry], {} as ResizeObserver);
    });

  return { observers, report };
}

describe("useMeasuredHeight", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the observed height and follows changes", () => {
    const { report } = stubResizeObserver();
    render(<Measured />);

    report(240);
    expect(screen.getByText("240px")).toBeInTheDocument();

    report(180);
    expect(screen.getByText("180px")).toBeInTheDocument();
  });

  it("stops observing when the element goes away", () => {
    const { observers } = stubResizeObserver();
    const { unmount } = render(<Measured />);

    unmount();

    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("leaves the natural height without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    render(<Measured />);

    expect(screen.getByText("natural")).toBeInTheDocument();
  });
});
