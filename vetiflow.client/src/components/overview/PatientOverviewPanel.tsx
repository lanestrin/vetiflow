import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { AcuityBadge } from "../clinical/AcuityBadge";
import { useNow } from "../board/useNow";
import { TriageDialog } from "../triage/TriageDialog";
import { completeTask, getCase, reopenTask } from "../../services/casesApi";
import type { CaseDetail, CaseDueItem, CaseTask } from "../../types/CaseDetail";
import { useToast } from "../shell/toastContext";
import { MoreActionsMenu } from "./MoreActionsMenu";
import {
  checkInLabel,
  dueLabel,
  eventDetail,
  eventLabel,
  isOverdue,
  locationLabel,
  longAgeLabel,
  speciesKind,
  taskMeta,
  temperatureLabel,
  timeLabel,
  weightLabel
} from "./overviewFormat";
import styles from "./PatientOverviewPanel.module.scss";

type LoadResult =
  | { kind: "shown"; detail: CaseDetail }
  | { kind: "notFound" }
  | { kind: "failed" };

interface PatientOverviewPanelProps {
  caseId: string | null;
  // When the board last loaded; a change loads the shown case again.
  refreshedAt: Date;
  // After triage is saved, with the toast to show; the board reloads.
  onTriaged: (message: string) => void;
  // After a task is ticked or unticked, saved or not: the board and this
  // panel reload, so the checklist shows the saved state (4.4b).
  onTaskSaved: () => void;
}

const avatars = { dog: "🐕", cat: "🐈", other: "🐾" };

const notRecorded = "Not recorded";

// The prototype's "Patient overview" (build plan 3.2b) for the card selected
// on the board. Complete triage and Re-triage open the triage dialog (4.2b);
// the buttons that later items wire are shown disabled.
export function PatientOverviewPanel({ caseId, refreshedAt, onTriaged, onTaskSaved }: PatientOverviewPanelProps) {
  const titleId = useId();
  const leaveWhenRefused = useLeaveWhenRefused();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [isTriaging, setIsTriaging] = useState(false);
  // A dialog for one case never carries over to the next selection.
  const [triageCaseId, setTriageCaseId] = useState(caseId);
  if (triageCaseId !== caseId) {
    setTriageCaseId(caseId);
    setIsTriaging(false);
  }
  // Keyed by case and attempt, so a board reload keeps the shown case on
  // screen while a new case or a retry shows "Loading case…".
  const [loaded, setLoaded] = useState<{ key: string; result: LoadResult } | null>(null);
  const key = `${caseId}:${attempt}`;

  useEffect(() => {
    if (caseId === null) {
      return;
    }

    let isActive = true;

    async function loadCase(id: string) {
      try {
        const detail = await getCase(id);
        if (isActive) {
          setLoaded({ key, result: detail ? { kind: "shown", detail } : { kind: "notFound" } });
        }
      } catch (loadError) {
        if (isActive && !leaveWhenRefused(loadError)) {
          setLoaded({ key, result: { kind: "failed" } });
        }
      }
    }

    void loadCase(caseId);

    return () => {
      isActive = false;
    };
  }, [caseId, key, refreshedAt, leaveWhenRefused]);

  const result = caseId !== null && loaded?.key === key ? loaded.result : null;
  const detail = result?.kind === "shown" ? result.detail : null;

  return (
    <aside className={styles.panel} aria-labelledby={titleId} aria-busy={caseId !== null && result === null}>
      <header className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.title}>Patient overview</h2>
          {detail && <CaseLine detail={detail} />}
        </div>
        {detail && (
          <MoreActionsMenu
            actions={detail.stage === "incoming" ? [] : [{ label: "Re-triage", onSelect: () => setIsTriaging(true) }]}
          />
        )}
      </header>

      {caseId === null && (
        <p className={styles.message}>Select a patient on the board to see their overview.</p>
      )}
      {caseId !== null && result === null && <p className={styles.message}>Loading case…</p>}
      {result?.kind === "notFound" && <p className={styles.message}>This case is no longer on the board.</p>}
      {result?.kind === "failed" && (
        <div className={styles.message} role="alert">
          <p>Unable to load this case.</p>
          <button type="button" className={styles.retry} onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}
      {detail && (
        <Overview
          detail={detail}
          nameRef={nameRef}
          onCompleteTriage={() => setIsTriaging(true)}
          onTaskSaved={onTaskSaved}
        />
      )}
      {detail && isTriaging && (
        <TriageDialog
          detail={detail}
          onClose={() => setIsTriaging(false)}
          onSaved={(message) => {
            // Closed here as well as by the dialog's close event, which the
            // browser may deliver after the board has moved on.
            setIsTriaging(false);
            // Complete triage disappears once the case reloads, so focus
            // moves to the patient instead of the page.
            nameRef.current?.focus();
            onTriaged(message);
          }}
        />
      )}
    </aside>
  );
}

function CaseLine({ detail }: { detail: CaseDetail }) {
  const now = useNow();

  return (
    <p className={styles.caseLine}>
      Case {detail.caseNumber}
      <span className={styles.separator} aria-hidden="true">·</span>
      {checkInLabel(detail.arrivalTime, now)}
    </p>
  );
}

interface OverviewProps {
  detail: CaseDetail;
  nameRef: RefObject<HTMLHeadingElement | null>;
  onCompleteTriage: () => void;
  onTaskSaved: () => void;
}

function Overview({ detail, nameRef, onCompleteTriage, onTaskSaved }: OverviewProps) {
  const now = useNow();
  const { patient, owner } = detail;
  const kind = speciesKind(patient.species);
  const meta = [patient.species, patient.breed, longAgeLabel(patient.dateOfBirth, now), weightLabel(detail.weightKg)]
    .filter(Boolean)
    .join(" · ");
  const vitals = detail.vitals[0];
  const tiles = [
    ["Heart rate", vitals?.heartRate == null ? null : `${vitals.heartRate} bpm`],
    ["Resp rate", vitals?.respiratoryRate == null ? null : `${vitals.respiratoryRate} /min`],
    ["Temp", temperatureLabel(vitals?.temperatureF ?? null)],
    // SpO₂ is stored from 4.8a.
    ["SpO₂", null]
  ];
  const blockers = detail.tasks.filter((task) => task.type === "blocker" && task.status === "open");
  const tasks = checklistTasks(detail.tasks);

  return (
    <>
      <div className={styles.hero}>
        <span className={styles.avatar} data-species={kind} aria-hidden="true">{avatars[kind]}</span>
        <div className={styles.identity}>
          <h3 ref={nameRef} className={styles.name} tabIndex={-1}>{patient.name}</h3>
          <p className={styles.meta}>{meta}</p>
        </div>
        <span className={styles.badge}>
          <AcuityBadge acuity={detail.acuity} isProvisional={detail.stage === "incoming"} />
        </span>
      </div>

      <div className={styles.ownerBar}>
        <div>
          <p className={styles.ownerLabel}>Pet parent</p>
          <p className={styles.ownerName}>
            {owner ? `${owner.firstName} ${owner.lastName}` : "No pet parent recorded"}
          </p>
        </div>
        {owner && (
          <div className={styles.ownerActions}>
            <button type="button" className={styles.linkButton} disabled>
              <span aria-hidden="true">☎ </span>Call
            </button>
            <button type="button" className={styles.linkButton} disabled>Message</button>
          </div>
        )}
      </div>

      <dl className={styles.vitals} aria-label="Latest vitals">
        {tiles.map(([label, value]) => (
          <div key={label} className={styles.vital}>
            <dt className={styles.vitalLabel}>{label}</dt>
            <dd className={styles.vitalValue}>{value ?? notRecorded}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.locationSection}>
        <p className={styles.row}>
          <span aria-hidden="true">📍</span>
          <span className={styles.rowLabel}>Location</span>
          <span className={styles.rowMeta}>{locationLabel(detail.room)}</span>
        </p>
        <DueRow icon="⏱" label="Next reassessment" item={detail.nextReassessment} now={now} />
        <DueRow icon="☎" label="Client update" item={detail.nextClientUpdate} now={now} />
      </div>

      <section className={styles.section} aria-labelledby={`${detail.id}-timeline`}>
        <h3 id={`${detail.id}-timeline`} className={styles.sectionTitle}>Care timeline</h3>
        {detail.timeline.length === 0 && blockers.length === 0 ? (
          <p className={styles.empty}>No events yet.</p>
        ) : (
          <ol className={styles.timeline}>
            {detail.timeline.map((caseEvent) => (
              <li key={caseEvent.id} className={styles.event}>
                <div className={styles.eventLine}>
                  <span className={styles.eventName}>{eventLabel(caseEvent.type)}</span>
                  <span className={styles.eventTime}>{timeLabel(caseEvent.createdAt, now)}</span>
                </div>
                <p className={styles.eventDetail}>{eventDetail(caseEvent)}</p>
              </li>
            ))}
            {blockers.map((blocker) => (
              <li key={blocker.id} className={styles.event} data-pending="true">
                <div className={styles.eventLine}>
                  <span className={styles.eventName}>{blocker.description}</span>
                  <span className={styles.eventTime}>Waiting</span>
                </div>
                <p className={styles.eventDetail}>
                  {blocker.assignedTo ? `Open blocker · ${blocker.assignedTo.name}` : "Open blocker"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.section} aria-labelledby={`${detail.id}-actions`}>
        <div className={styles.sectionTop}>
          <h3 id={`${detail.id}-actions`} className={styles.sectionTitle}>Next actions</h3>
          <button type="button" className={styles.linkButton} disabled>＋ Add task</button>
        </div>
        {tasks.length === 0 ? (
          <p className={styles.empty}>No tasks yet.</p>
        ) : (
          <TaskChecklist caseId={detail.id} caseTasks={detail.tasks} onTaskSaved={onTaskSaved} />
        )}
      </section>

      <div className={styles.actions}>
        {detail.stage === "incoming" && (
          <button type="button" className={`${styles.button} ${styles.triage}`} onClick={onCompleteTriage}>
            <span aria-hidden="true">✓ </span>Complete triage
          </button>
        )}
        <button type="button" className={`${styles.button} ${styles.secondary}`} disabled>
          <span aria-hidden="true">⇄ </span>Handoff
        </button>
        <button type="button" className={styles.button} disabled>Update status</button>
      </div>
    </>
  );
}

interface DueRowProps {
  icon: string;
  label: string;
  item: CaseDueItem | null;
  now: Date;
}

// The prototype's "Next reassessment" and "Client update" rows (4.4b). An
// overdue time says so in words as well as colour.
function DueRow({ icon, label, item, now }: DueRowProps) {
  const dueAt = item?.dueAt ?? null;

  return (
    <p className={styles.row}>
      <span aria-hidden="true">{icon}</span>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowMeta} data-overdue={isOverdue(dueAt, now)}>{dueLabel(dueAt, now)}</span>
    </p>
  );
}

interface TaskChecklistProps {
  caseId: string;
  // Every task on the case, as loaded; the checklist shows the plain tasks.
  caseTasks: CaseTask[];
  onTaskSaved: () => void;
}

// Ticking completes a task and unticking reopens it (4.4b). The tick changes
// at once; a failure puts it back and the reload shows the saved state.
function TaskChecklist({ caseId, caseTasks, onTaskSaved }: TaskChecklistProps) {
  const leaveWhenRefused = useLeaveWhenRefused();
  const showToast = useToast();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // A reload brings the saved state, so earlier ticks no longer apply.
  const [followedTasks, setFollowedTasks] = useState(caseTasks);
  if (caseTasks !== followedTasks) {
    setFollowedTasks(caseTasks);
    setTicked({});
  }
  const tasks = checklistTasks(caseTasks);

  async function toggle(task: CaseTask, isDone: boolean) {
    setTicked((current) => ({ ...current, [task.id]: isDone }));
    setSavingId(task.id);

    try {
      await (isDone ? completeTask(caseId, task.id) : reopenTask(caseId, task.id));
    } catch (saveError) {
      if (leaveWhenRefused(saveError)) {
        return;
      }

      setTicked((current) => {
        const reverted = { ...current };
        delete reverted[task.id];
        return reverted;
      });
      showToast("Couldn't update the task. Try again.");
    } finally {
      setSavingId(null);
    }

    onTaskSaved();
  }

  return (
    <ul className={styles.tasks}>
      {tasks.map((task) => {
        const isDone = ticked[task.id] ?? task.status === "done";
        return (
          <li key={task.id} className={styles.row} data-done={isDone}>
            <label className={styles.taskLabel}>
              <input
                type="checkbox"
                className={styles.checkInput}
                checked={isDone}
                disabled={savingId === task.id}
                onChange={(event) => void toggle(task, event.target.checked)}
              />
              <span className={styles.check} aria-hidden="true">{isDone ? "✓" : ""}</span>
              <span className={styles.rowLabel}>{task.description}</span>
            </label>
            <span className={styles.rowMeta}>{taskMeta(task)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// The Next actions checklist: plain tasks that are not cancelled. Blockers
// show in the timeline and due items in their own rows.
function checklistTasks(caseTasks: CaseTask[]): CaseTask[] {
  return caseTasks.filter((task) => task.type === "task" && task.status !== "cancelled");
}
