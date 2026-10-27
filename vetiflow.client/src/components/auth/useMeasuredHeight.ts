import { useEffect, useState } from "react";

// The watched element's height, kept up to date as it resizes, so a wrapper
// can ease to it. When the watched element changes, the last height is kept
// until the new one is measured, so the wrapper eases from old to new instead
// of snapping. Without ResizeObserver (tests, old browsers) it is undefined,
// and the wrapper keeps its natural height.
export function useMeasuredHeight(element: Element | null): number | undefined {
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    if (!element || typeof ResizeObserver !== "function") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return height;
}
