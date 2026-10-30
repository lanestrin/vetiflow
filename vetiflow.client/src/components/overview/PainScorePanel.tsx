import { useId } from "react";
import type { PainScore } from "../../types/CaseDetail";
import { timeLabel } from "./overviewFormat";
import styles from "./PainScorePanel.module.scss";

interface PainScorePanelProps {
  score: PainScore | null;
  now: Date;
}

export function PainScorePanel({ score, now }: PainScorePanelProps) {
  const titleId = useId();

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h3 id={titleId}>Pain score</h3>
        <span>{score === null ? "Not recorded" : `${score.score} / 10`}</span>
      </div>
      <div
        className={styles.track}
        role={score === null ? undefined : "meter"}
        aria-hidden={score === null || undefined}
        aria-labelledby={score === null ? undefined : titleId}
        aria-valuemin={score === null ? undefined : 0}
        aria-valuemax={score === null ? undefined : 10}
        aria-valuenow={score?.score}
        aria-valuetext={score === null ? undefined : `${score.score} out of 10`}
      >
        {score !== null && <span className={styles.marker} data-score={score.score} />}
      </div>
      <div className={styles.labels} aria-hidden="true">
        <span>0 · comfortable</span><span>5</span><span>10 · severe</span>
      </div>
      <div className={styles.foot}>
        <p className={styles.meta}>
          {score === null
            ? "Use the clinic's approved species-specific scale."
            : `Recorded ${timeLabel(score.recordedAt, now)}${score.recordedBy ? ` · ${score.recordedBy.name}` : ""}`}
        </p>
        <button type="button" className={styles.record} disabled>＋ Record score</button>
      </div>
      {score?.notes && <p className={styles.notes}>{score.notes}</p>}
    </section>
  );
}
