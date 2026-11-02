import type { VitalsRecord } from "../../types/CaseDetail";
import { recordTimeLabel } from "./overviewFormat";
import { vitalsChanges } from "./vitalsChanges";
import styles from "./VitalsChangeSummary.module.scss";

// What one saved vitals set changed since the set saved before it (4.8g),
// naming that set by its entry time so the comparison is never ambiguous.
export function VitalsChangeSummary({ current, previous, now }: { current: VitalsRecord; previous: VitalsRecord; now: Date }) {
  const { changed, added, missing, unchanged } = vitalsChanges(current, previous);
  const enteredAt = recordTimeLabel(previous.recordedAt, now);

  return (
    <div className={styles.summary}>
      <p className={styles.compared}>
        {enteredAt === null
          ? "Compared with the previous saved set"
          : <>Compared with the set entered <time dateTime={previous.recordedAt}>{enteredAt}</time></>}
      </p>
      {changed.length + added.length + missing.length + unchanged.length === 0
        ? <p className={styles.compared}>No readings recorded in either set</p>
        : (
          <dl className={styles.changes}>
            {changed.map(change => <div key={change.label}>
              <dt>{change.label}</dt><dd>{change.from} → {change.to}</dd>
            </div>)}
            {added.map(change => <div key={change.label}>
              <dt>{change.label}</dt><dd>{change.value}, not recorded in the previous set</dd>
            </div>)}
            {missing.map(change => <div key={change.label}>
              <dt>{change.label}</dt><dd>Not recorded in this set; previous set {change.previous}</dd>
            </div>)}
            {unchanged.length > 0 && <div>
              <dt>Unchanged</dt><dd>{unchanged.map(item => `${item.label} ${item.value}`).join(", ")}</dd>
            </div>}
          </dl>
        )}
    </div>
  );
}
