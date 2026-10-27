import { useEffect, useRef } from "react";

// Calls onFrame with the seconds since the loop started, once per animation
// frame, while isRunning is true. It pauses while the tab is hidden, so a
// background tab costs nothing, and stops when the component unmounts.
export function useAnimationLoop(onFrame: (seconds: number) => void, isRunning: boolean) {
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

    const tick = (now: number) => {
      startedAt ??= now;
      onFrameRef.current((now - startedAt) / 1000);
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      frame = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (frame === 0) {
        start();
      }
    };

    if (!document.hidden) {
      start();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, [isRunning]);
}
