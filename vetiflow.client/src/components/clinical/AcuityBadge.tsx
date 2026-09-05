import type { AcuityLevel } from "../../types/EmergencyCaseListItem";
import styles from "./AcuityBadge.module.scss";

interface AcuityBadgeProps {
  acuity: AcuityLevel | null;
}

export function AcuityBadge({ acuity }: AcuityBadgeProps) {
  if (acuity === null) {
    return (
      <span className={`${styles.badge} ${styles.untriaged}`}>
        Not triaged
      </span>
    );
  }

  const label = {
    critical: "Critical",
    urgent: "Urgent",
    stable: "Stable",
    low: "Low"
  }[acuity];

  return (
    <span
      className={styles.badge}
      data-acuity={acuity}
    >
      {label}
    </span>
  );
}