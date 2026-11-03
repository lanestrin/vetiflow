import type { CaseReference, EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { AcuityBadge } from "../clinical/AcuityBadge";
import { speciesKind } from "../overview/overviewFormat";
import { ageLabel, minutesSince, stageLabel } from "./boardFormat";
import styles from "./PatientRow.module.scss";

interface PatientRowProps {
  emergencyCase: EmergencyCaseListItem;
  now: Date;
  isSelected: boolean;
  onSelect: (caseId: string) => void;
  // Lets the board return focus here when the record closes (3.2f).
  nameButtonRef?: (element: HTMLButtonElement | null) => void;
}

const avatars = { dog: "🐕", cat: "🐈", other: "🐾" };

// The minutes say what they measure: time in the current stage, or, before
// triage, time since arrival.
function elapsedLabel(emergencyCase: EmergencyCaseListItem, now: Date): string {
  return emergencyCase.stage === "incoming"
    ? `Waiting ${minutesSince(emergencyCase.arrivalTime, now)} min`
    : `${minutesSince(emergencyCase.stageEnteredAt, now)} min in stage`;
}

function blockersLabel(count: number): string {
  return count === 1 ? "1 open blocker" : `${count} open blockers`;
}

// One case on the board table (build plan 2.25, the prototype's `tbody tr`).
// The name button is the control for keyboards and screen readers; a click
// anywhere else on the row selects it too, for the mouse.
export function PatientRow({ emergencyCase, now, isSelected, onSelect, nameButtonRef }: PatientRowProps) {
  const {
    id,
    patientName,
    species,
    breed,
    patientDateOfBirth,
    stage,
    acuity,
    assignedTechnician,
    assignedDoctor,
    blockers
  } = emergencyCase;
  const kind = [species, breed, ageLabel(patientDateOfBirth, now)].filter(Boolean).join(" · ");

  return (
    <tr className={styles.row} data-selected={isSelected} onClick={() => onSelect(id)}>
      <td className={styles.patientCell}>
        <div className={styles.patient}>
          <span className={styles.avatar} data-species={speciesKind(species)} aria-hidden="true">
            {avatars[speciesKind(species)]}
          </span>
          <div className={styles.identity}>
            <button
              ref={nameButtonRef}
              type="button"
              className={styles.name}
              aria-pressed={isSelected}
              onClick={(event) => {
                // The row's own click would select a second time.
                event.stopPropagation();
                onSelect(id);
              }}
            >
              {patientName}
            </button>
            <p className={styles.kind}>{kind}</p>
          </div>
        </div>
      </td>
      <td className={styles.acuityCell}>
        <AcuityBadge acuity={acuity} isProvisional={stage === "incoming"} />
      </td>
      <td className={styles.stageCell} data-label="Care stage">
        <p className={styles.stage}>{stageLabel(stage)}</p>
        <p className={styles.muted}>{elapsedLabel(emergencyCase, now)}</p>
        {blockers.length > 0 && <p className={styles.blockers}>{blockersLabel(blockers.length)}</p>}
      </td>
      <td className={styles.teamCell} data-label="Care team">
        <Assignment role="Tech" person={assignedTechnician} />
        <Assignment role="Vet" person={assignedDoctor} />
      </td>
      <td className={styles.chevron} aria-hidden="true">›</td>
    </tr>
  );
}

// Technician first, then veterinarian, the same in every role view.
function Assignment({ role, person }: { role: string; person: CaseReference | null }) {
  return (
    <p className={styles.assignment}>
      <span className={styles.assignmentRole}>{role}</span>
      <span className={styles.assignmentName} data-unassigned={person === null}>
        {person?.name ?? "Unassigned"}
      </span>
    </p>
  );
}
