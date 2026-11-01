import type { BoardSummary } from "../../types/BoardSummary";
import { shiftChipLabel } from "./boardFormat";
import styles from "./BoardHeading.module.scss";

interface BoardHeadingProps {
  // Null while the summary is unavailable; keep the board heading and intake.
  summary: BoardSummary | null;
  onIntake: () => void;
}

export function BoardHeading({ summary, onIntake }: BoardHeadingProps) {
  return (
    <header className={styles.heading}>
      <div>
        {summary && <p className={styles.eyebrow}>{summary.clinicName}</p>}
        <h1 className={styles.title}>ER Command Center</h1>
        <p className={styles.sub}>Live patient flow and care coordination</p>
      </div>
      <div className={styles.headRight}>
        {summary && (
          <p className={styles.shift}>
            <span className={styles.live} aria-hidden="true" />
            {shiftChipLabel(summary)}
          </p>
        )}
        <button type="button" className={styles.intakeButton} onClick={onIntake}>
          <span aria-hidden="true">＋ </span>New intake
        </button>
      </div>
    </header>
  );
}
