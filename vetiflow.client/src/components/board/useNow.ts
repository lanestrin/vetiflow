import { useEffect, useState } from "react";

// The current time, refreshed on an interval, so minutes on the board count up
// without a reload.
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs]);

  return now;
}
