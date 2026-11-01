import type { AcuityLevel, EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { ageLabel, minutesSince, stageLabel, waitChipLabel } from "./boardFormat";
import styles from "./PatientCard.module.scss";

interface PatientCardProps {
  emergencyCase: EmergencyCaseListItem;
  now: Date;
  isSelected: boolean;
  onSelect: (caseId: string) => void;
}

const priorityLabels: Record<AcuityLevel, string> = {
  critical: "Critical",
  urgent: "Urgent",
  stable: "Stable"
};

// One case on the patient flow board (prototype `.patient`). The name is a
// button stretched over the card, so the whole card selects it.
export function PatientCard({ emergencyCase, now, isSelected, onSelect }: PatientCardProps) {
  const {
    patientName,
    species,
    breed,
    patientDateOfBirth,
    ownerName,
    presentingComplaint,
    stage,
    stageEnteredAt,
    acuity,
    arrivalTime,
    waitChip,
    clinician,
    blockers,
    tags
  } = emergencyCase;
  const isIncoming = stage === "incoming";
  const kind = [species, breed, ageLabel(patientDateOfBirth, now)].filter(Boolean).join(" · ");
  const ownerLine = ownerName ? `${ownerName} · ${presentingComplaint}` : presentingComplaint;
  const stageLine = isIncoming
    ? stageLabel(stage)
    : `${stageLabel(stage)} · ${minutesSince(stageEnteredAt, now)} min`;

  return (
    <article
      className={styles.card}
      data-selected={isSelected}
      data-incoming={isIncoming}
    >
      <div className={styles.row}>
        <div>
          <h4 className={styles.name}>
            <button
              type="button"
              className={styles.select}
              aria-pressed={isSelected}
              onClick={() => onSelect(emergencyCase.id)}
            >
              {patientName}
            </button>
          </h4>
          <p className={styles.kind}>{kind}</p>
        </div>
        <span className={styles.wait}>{waitChipLabel(waitChip, arrivalTime, now)}</span>
      </div>

      <p className={styles.owner}>{ownerLine}</p>

      {(isIncoming && acuity) || tags.length > 0 || blockers.length > 0 ? (
        <ul className={styles.tags} aria-label="Tags">
          {isIncoming && acuity && (
            <li className={styles.tag} data-tone={acuity}>
              {priorityLabels[acuity]} · provisional
            </li>
          )}
          {tags.map((tag) => (
            <li key={tag.id} className={styles.tag} data-tone={tag.tone}>
              {tag.text}
            </li>
          ))}
          {blockers.map((blocker) => (
            <li key={blocker.id} className={styles.tag} data-tone="critical">
              {blocker.description}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.foot}>
        <span>{stageLine}</span>
        <span className={styles.assigned}>
          <span className={styles.avatar} aria-hidden="true">
            {clinician?.initials ?? "--"}
          </span>
          {clinician?.shortName ?? "Unassigned"}
        </span>
      </div>
    </article>
  );
}
