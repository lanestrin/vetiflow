import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import styles from "./ErBoardStatusBar.module.scss";

interface ErBoardStatusBarProps {
  cases: EmergencyCaseListItem[];
}

export function ErBoardStatusBar({
  cases
}: ErBoardStatusBarProps) {
  const totalPatients = cases.length;

  const criticalPatients = cases.filter(
    (emergencyCase) =>
      emergencyCase.acuity === "critical"
  ).length;

  const waitingPatients = cases.filter(
    (emergencyCase) =>
      emergencyCase.status === "waiting"
  ).length;

  return (
    <section
      className={styles.statusBar}
      aria-label="ER status"
    >
      <div className={styles.item}>
        <strong className={styles.value}>
          {totalPatients}
        </strong>
        <span className={styles.label}>
          Patients in ER
        </span>
      </div>

      <div className={styles.item}>
        <strong className={styles.value}>
          {criticalPatients}
        </strong>
        <span className={styles.label}>
          Critical
        </span>
      </div>

      <div className={styles.item}>
        <strong className={styles.value}>
          {waitingPatients}
        </strong>
        <span className={styles.label}>
          Waiting
        </span>
      </div>
    </section>
  );
}