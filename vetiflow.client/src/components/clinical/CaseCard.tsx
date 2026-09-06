import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import styles from "./CaseCard.module.scss";

import { AcuityBadge } from "./AcuityBadge";
import { CaseTimer } from "./CaseTimer";
import { CaseStatusLabel } from "./CaseStatusLabel";

interface CaseCardProps {
  emergencyCase: EmergencyCaseListItem;
}

export function CaseCard({ emergencyCase }: CaseCardProps) {
  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.patientName}>
            {emergencyCase.patientName}
          </h2>

          <p className={styles.patientDetails}>
            {emergencyCase.species}
            {emergencyCase.breed && ` • ${emergencyCase.breed}`}
          </p>
        </div>

        <CaseTimer arrivalTime={emergencyCase.arrivalTime} />
      </header>

      <p className={styles.complaint}>
        {emergencyCase.presentingComplaint}
      </p>

      <dl className={styles.details}>
        <div className={styles.detail}>
          <dt className={styles.detailLabel}>Acuity</dt>
          <dd className={styles.detailValue}>
            <AcuityBadge acuity={emergencyCase.acuity} />
          </dd>
        </div>

        <div className={styles.detail}>
          <dt className={styles.detailLabel}>Status</dt>
          <dd className={styles.detailValue}>
            <CaseStatusLabel status={emergencyCase.status} />
          </dd>
        </div>

        <div className={styles.detail}>
          <dt className={styles.detailLabel}>Weight</dt>
          <dd className={styles.detailValue}>
            {emergencyCase.weightKg !== null
              ? `${emergencyCase.weightKg} kg`
              : "Not recorded"}
          </dd>
        </div>
      </dl>

      {emergencyCase.nextAction && (
        <p className={styles.nextAction}>
          <strong>Next:</strong> {emergencyCase.nextAction}
        </p>
      )}
    </article>
  );
}