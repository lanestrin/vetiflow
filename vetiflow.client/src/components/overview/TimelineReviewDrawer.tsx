import { useId } from "react";
import type { CaseDetail, CaseTask, CaseTaskStatus, CaseTaskType } from "../../types/CaseDetail";
import { useNow } from "../board/useNow";
import { CaseReviewDrawer, type ReviewDrawerProps } from "./CaseReviewDrawer";
import { eventLabel, recordTimeLabel } from "./overviewFormat";
import { EnteredTime, MeasuredTime } from "./RecordedTimes";
import styles from "./TimelineReviewDrawer.module.scss";

const taskTypes: Record<CaseTaskType, string> = {
  task: "Task", blocker: "Blocker", reassessment: "Reassessment", clientUpdate: "Client update"
};
const taskStatuses: Record<CaseTaskStatus, string> = { open: "Open", done: "Done", cancelled: "Cancelled" };

// These are presentation rows from saved sources, not new CaseEvents.
function recordedHistory(detail: CaseDetail) {
  const events = detail.timeline.map(event => ({
    key: `event:${event.id}`, title: eventLabel(event.type), description: event.description,
    timestamp: event.createdAt, actor: event.createdBy, vitals: false, occurredAt: null as string | null
  }));
  const vitals = detail.vitals.map(record => ({
    key: `vitals:${record.id}`, title: "Vitals recorded", description: null,
    timestamp: record.recordedAt, actor: record.recordedBy, vitals: true, occurredAt: record.occurredAt
  }));
  // Stable sorting preserves source order at equal times, with events first.
  return [...events, ...vitals].sort((first, second) => {
    const firstTime = Date.parse(first.timestamp);
    const secondTime = Date.parse(second.timestamp);
    const firstOrder = Number.isFinite(firstTime) ? firstTime : Infinity;
    const secondOrder = Number.isFinite(secondTime) ? secondTime : Infinity;
    return firstOrder === secondOrder ? 0 : firstOrder < secondOrder ? -1 : 1;
  });
}

function RecordTime({ value, now }: { value: string; now: Date }) {
  const label = recordTimeLabel(value, now);
  return label === null
    ? <>Time not available</>
    : <time dateTime={value}>{label}</time>;
}

export function TimelineReviewDrawer(props: ReviewDrawerProps) {
  const id = useId();
  const now = useNow();
  const { detail } = props;
  const history = recordedHistory(detail);

  return (
    <CaseReviewDrawer {...props} title="Timeline">
      <section aria-labelledby={`${id}-history`}>
        <h3 id={`${id}-history`}>Recorded history</h3>
        <p className={styles.meta}>Saved case events and vitals entries, ordered by recorded or entry time.
          Vitals show when they were measured where that was recorded; case event times are when they were saved.</p>
        {history.length === 0 ? <p className={styles.meta}>No history recorded</p> : (
          <ol className={styles.records}>
            {history.map(row => <li key={row.key}>
              <h4>{row.title}</h4>
              {row.description && <p>{row.description}</p>}
              {row.vitals ? <>
                <p className={styles.meta}><MeasuredTime occurredAt={row.occurredAt} now={now} withTime /></p>
                <p className={styles.meta}><EnteredTime recordedAt={row.timestamp} now={now} /></p>
                {row.actor && <p className={styles.meta}>Entered by {row.actor.name}</p>}
              </> : <>
                <p className={styles.meta}>Recorded <RecordTime value={row.timestamp} now={now} /></p>
                {row.actor && <p className={styles.meta}>Recorded by {row.actor.name}</p>}
              </>}
            </li>)}
          </ol>
        )}
      </section>
      <section aria-labelledby={`${id}-tasks`}>
        <h3 id={`${id}-tasks`}>Current care tasks</h3>
        <p className={styles.meta}>These records show current task state, not every prior change.
          Due times are scheduled times, not evidence that care was performed.</p>
        {detail.tasks.length === 0 ? <p className={styles.meta}>No tasks recorded</p> : (
          <ul className={styles.records}>
            {detail.tasks.map(task => <li key={task.id}>
              <h4>{task.description}</h4>
              <p>{taskTypes[task.type]} · {taskStatuses[task.status]}</p>
              <TaskMetadata task={task} now={now} />
            </li>)}
          </ul>
        )}
      </section>
    </CaseReviewDrawer>
  );
}

function TaskMetadata({ task, now }: { task: CaseTask; now: Date }) {
  const resolution = task.status === "done" ? "Completed" : "Resolved";
  return <dl className={styles.metadata}>
    <div><dt>Created</dt><dd><RecordTime value={task.createdAt} now={now} /></dd></div>
    {task.createdBy && <div><dt>Created by</dt><dd>{task.createdBy.name}</dd></div>}
    {task.assignedTo && <div><dt>Assigned to</dt><dd>{task.assignedTo.name}</dd></div>}
    {task.dueAt !== null && <div><dt>Scheduled due</dt><dd><RecordTime value={task.dueAt} now={now} /></dd></div>}
    {task.status !== "open" && <>
      {task.resolvedAt !== null && <div><dt>{resolution}</dt><dd><RecordTime value={task.resolvedAt} now={now} /></dd></div>}
      {task.resolvedBy && <div><dt>{resolution} by</dt><dd>{task.resolvedBy.name}</dd></div>}
    </>}
  </dl>;
}
