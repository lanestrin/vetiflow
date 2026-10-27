import { useEffect, useRef, useState } from "react";

// How a sign-in request ended. "dropped" means there is nothing to show:
// another request was already running, or this one was cancelled.
export type RequestOutcome<T> =
  | { kind: "done"; value: T }
  | { kind: "failed" }
  | { kind: "dropped" };

// One sign-in request at a time for a form. The ref, not the disabled button,
// stops a second press: it is set before React re-renders. When the form is
// no longer the active sign-in method (or unmounts), its request is
// cancelled and its result dropped, so it can't change the flow the person
// switched to.
export function useSignInRequest(isActive: boolean) {
  const controllerRef = useRef<AbortController | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // The clean-up runs when the form stops being active, and on unmount.
  useEffect(() => {
    if (!isActive) {
      return;
    }

    return () => controllerRef.current?.abort();
  }, [isActive]);

  async function run<T>(request: (signal: AbortSignal) => Promise<T>): Promise<RequestOutcome<T>> {
    if (controllerRef.current) {
      return { kind: "dropped" };
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setIsWorking(true);

    try {
      const value = await request(controller.signal);
      return controller.signal.aborted ? { kind: "dropped" } : { kind: "done", value };
    } catch {
      return controller.signal.aborted ? { kind: "dropped" } : { kind: "failed" };
    } finally {
      controllerRef.current = null;
      setIsWorking(false);
    }
  }

  return { isWorking, run };
}

// A pause for steps the demo only simulates, run inside `run` so it is
// cancelled like a real request.
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}
