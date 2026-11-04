import { useEffect, useId, useRef } from "react";
import type { BoardSummary, ShiftDoorToDoctor } from "../../types/BoardSummary";
import { doorToDoctorChangeSentence } from "./boardFormat";
import styles from "./DoorToDoctorDialog.module.scss";

interface DoorToDoctorDialogProps {
  isOpen: boolean;
  // The board's summary; the dialog updates with it while open.
  summary: BoardSummary;
  onShowWaiting: () => void;
  onClose: () => void;
}

function shiftLine(shift: ShiftDoorToDoctor): string {
  if (shift.averageMinutes === null) {
    return "No vet assessments recorded yet";
  }

  const patients = shift.assessed === 1 ? "1 patient" : `${shift.assessed} patients`;
  return `${shift.averageMinutes} min average · ${patients} assessed`;
}

function waitingLine(waiting: number): string {
  return `${waiting === 1 ? "1 patient" : `${waiting} patients`} waiting for a vet assessment`;
}

// The heading chip's details (build plan 2.16b): this shift against last shift
// and the patients still waiting for a vet. A native modal dialog keeps focus
// inside, closes on Escape and returns focus to the chip that opened it.
export function DoorToDoctorDialog({ isOpen, summary, onShowWaiting, onClose }: DoorToDoctorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { currentShift, previousShift, waiting } = summary.doorToDoctor;
  const change = doorToDoctorChangeSentence(summary);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) {
          event.currentTarget.close();
        }
      }}
    >
      <div className={styles.inner}>
        <h2 id={titleId} className={styles.title}>Door to first doctor</h2>
        <dl className={styles.shifts}>
          <div className={styles.shift}>
            <dt>This shift</dt>
            <dd>{shiftLine(currentShift)}</dd>
          </div>
          <div className={styles.shift}>
            <dt>Last shift</dt>
            <dd>{shiftLine(previousShift)}</dd>
          </div>
        </dl>
        {change && <p className={styles.change}>{change}</p>}
        <p className={styles.waiting}>{waitingLine(waiting)}</p>
        <p className={styles.note}>Arrival to the recorded vet assessment, for patients who arrived during each shift.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()}>
            Close
          </button>
          <button type="button" className={styles.primary} onClick={onShowWaiting}>
            Show waiting patients
          </button>
        </div>
      </div>
    </dialog>
  );
}
