import { useEffect, useRef } from "react";

// Calls onFrame with the seconds since the loop started, once per animation
// frame, while isRunning is true. It pauses while the tab is hidden and,
// given an element, while that element is off screen (scrolled away or not
// displayed), so hidden art costs nothing. It stops when the component
// unmounts.
export function useAnimationLoop(
  onFrame: (seconds: number) => void,
  isRunning: boolean,
  element?: Element | null
) {
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!isRunning || typeof window.requestAnimationFrame !== "function") {
      return;
    }

    let frame = 0;
    let startedAt: number | undefined;
    // Without IntersectionObserver (tests, old browsers) it counts as on screen.
    let isOnScreen = true;

    const tick = (now: number) => {
      startedAt ??= now;
      onFrameRef.current((now - startedAt) / 1000);
      frame = window.requestAnimationFrame(tick);
    };

    // Runs only while the tab is shown and the element is on screen.
    const update = () => {
      const shouldRun = !document.hidden && isOnScreen;
      if (shouldRun && frame === 0) {
        frame = window.requestAnimationFrame(tick);
      } else if (!shouldRun && frame !== 0) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    let observer: IntersectionObserver | undefined;
    if (element && typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(([entry]) => {
        isOnScreen = entry.isIntersecting;
        update();
      });
      observer.observe(element);
    }

    update();
    document.addEventListener("visibilitychange", update);

    return () => {
      document.removeEventListener("visibilitychange", update);
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [isRunning, element]);
}
