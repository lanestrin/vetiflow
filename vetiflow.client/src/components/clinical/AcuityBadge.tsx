import type { AcuityLevel } from "../../types/EmergencyCaseListItem";
import { acuityBadgeLabel } from "./acuityBadgeLabel";
import styles from "./AcuityBadge.module.scss";

interface AcuityBadgeProps {
  acuity: AcuityLevel | null;
  // An intake's priority, before a clinician completes triage (4.1).
  isProvisional?: boolean;
}

export function AcuityBadge({ acuity, isProvisional = false }: AcuityBadgeProps) {
  if (acuity === null) {
    return (
      <span className={`${styles.badge} ${styles.untriaged}`}>
        {acuityBadgeLabel(acuity)}
      </span>
    );
  }

  return (
    <span
      className={styles.badge}
      data-acuity={acuity}
    >
      {acuityBadgeLabel(acuity, isProvisional)}
    </span>
  );
}