import { useEffect, useState } from "react";
import styles from "./CaseTimer.module.scss";

interface CaseTimerProps {
  arrivalTime: string;
}

export function CaseTimer({ arrivalTime }: CaseTimerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const arrival = new Date(arrivalTime);

  const elapsedMilliseconds = now.getTime() - arrival.getTime();

  const elapsedMinutes = Math.max(
    0,
    Math.floor(elapsedMilliseconds / 60000)
  );

  if (elapsedMinutes < 60) {
    return (
      <span className={styles.timer}>
        {elapsedMinutes} min
      </span>
    );
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  return (
    <span className={styles.timer}>
      {hours} hr {minutes} min
    </span>
  );
}