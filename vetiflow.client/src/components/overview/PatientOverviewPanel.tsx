import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { AcuityBadge } from "../clinical/AcuityBadge";
import { useNow } from "../board/useNow";
import { AddTaskDialog } from "../tasks/AddTaskDialog";
import { DueItemDialog, type DueItemType } from "../tasks/DueItemDialog";
import { TriageDialog } from "../triage/TriageDialog";
import { RecordVitalsDialog } from "../vitals/RecordVitalsDialog";
import { RecordPainScoreDialog } from "../pain/RecordPainScoreDialog";
import { completeTask, getCase, reopenTask } from "../../services/casesApi";
import type { CaseDetail, CaseDueItem, CaseTask, VitalName } from "../../types/CaseDetail";
import { useToast } from "../shell/toastContext";
import { MoreActionsMenu } from "./MoreActionsMenu";
import { PainScorePanel } from "./PainScorePanel";
import { ClinicalReviewDrawer } from "./ClinicalReviewDrawer";
import { MedicationReviewDrawer } from "./MedicationReviewDrawer";
import { TimelineReviewDrawer } from "./TimelineReviewDrawer";
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
  // After a task is ticked, unticked or added, or a due row set or done,
  // saved or not: the board and this panel reload, so they show the saved
  // state (4.4b, 4.4c).
  onTaskSaved: () => void;
  // Reload the board after recording vitals or finding this case unavailable.
  onVitalsSaved: () => void;
  onPainScoreSaved: () => void;
}

type TaskDialogKind = "addTask" | DueItemType;
type ReviewKind = "clinical" | "medications" | "timeline";

const reviewDrawers = { clinical: ClinicalReviewDrawer, medications: MedicationReviewDrawer, timeline: TimelineReviewDrawer };

const avatars = { dog: "🐕", cat: "🐈", other: "🐾" };

const notRecorded = "Not recorded";

// The prototype's "Patient overview" (build plan 3.2b) for the card selected
// on the board. Complete triage and Re-triage open the triage dialog (4.2b);
// the buttons that later items wire are shown disabled.
export function PatientOverviewPanel({ caseId, refreshedAt, onTriaged, onTaskSaved, onVitalsSaved, onPainScoreSaved }: PatientOverviewPanelProps) {
  const titleId = useId();
  const leaveWhenRefused = useLeaveWhenRefused();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const recordVitalsRef = useRef<HTMLButtonElement>(null);
  const recordPainRef = useRef<HTMLButtonElement>(null);
  const clinicalRef = useRef<HTMLButtonElement>(null);
  const medicationsRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [assessmentRevision, setAssessmentRevision] = useState(0);
  const showToast = useToast();
  const [isTriaging, setIsTriaging] = useState(false);
  const [taskDialog, setTaskDialog] = useState<TaskDialogKind | null>(null);
  const [vitalsDialogCase, setVitalsDialogCase] = useState<CaseDetail | null>(null);
  const [painDialogCase, setPainDialogCase] = useState<CaseDetail | null>(null);
  const [review, setReview] = useState<{ caseId: string; kind: ReviewKind } | null>(null);
  // A dialog for one case never carries over to the next selection.
  const [dialogCaseId, setDialogCaseId] = useState(caseId);
  if (dialogCaseId !== caseId) {
    setDialogCaseId(caseId);
    setIsTriaging(false);
    setTaskDialog(null);
    setVitalsDialogCase(null);
    setPainDialogCase(null);
    setReview(null);
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
          if (!detail) setReview(null);
          setLoaded({ key, result: detail ? { kind: "shown", detail } : { kind: "notFound" } });
        }
      } catch (loadError) {
        if (isActive) {
          setReview(null);
          if (!leaveWhenRefused(loadError)) setLoaded({ key, result: { kind: "failed" } });
        }
      }
    }

    void loadCase(caseId);

    return () => {
      isActive = false;
    };
  }, [caseId, key, refreshedAt, leaveWhenRefused, assessmentRevision]);

  const result = caseId !== null && loaded?.key === key ? loaded.result : null;
  const detail = result?.kind === "shown" ? result.detail : null;
  const ReviewDrawer = reviewDrawers[review?.kind ?? "clinical"];
  const reviewTriggers = { clinical: clinicalRef, medications: medicationsRef, timeline: timelineRef };

  return (
    <aside className={styles.panel} aria-labelledby={titleId} aria-busy={caseId !== null && result === null}>
      <header className={styles.head}>
        <div>
          <h2 ref={headingRef} tabIndex={-1} id={titleId} className={styles.title}>Patient overview</h2>
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
          onAddTask={() => setTaskDialog("addTask")}
          onSetDue={setTaskDialog}
          onTaskSaved={onTaskSaved}
          onRecordVitals={() => setVitalsDialogCase(detail)}
          recordVitalsRef={recordVitalsRef}
          onRecordPain={() => setPainDialogCase(detail)}
          recordPainRef={recordPainRef}
          onOpenReview={kind => setReview({ caseId: detail.id, kind })}
          clinicalRef={clinicalRef}
          medicationsRef={medicationsRef}
          timelineRef={timelineRef}
        />
      )}
      {detail && review?.caseId === detail.id && (
        <ReviewDrawer key={`${detail.id}:${review.kind}`} detail={detail}
          triggerRef={reviewTriggers[review.kind]} fallbackRef={headingRef}
          onClose={() => setReview(current => current === review ? null : current)} />
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
      {detail && taskDialog !== null && (
        <TaskDialog
          kind={taskDialog}
          detail={detail}
          onClose={() => setTaskDialog(null)}
          onSaved={(message) => {
            // Closed here too, in case the close event comes late (as triage).
            setTaskDialog(null);
            showToast(message);
            onTaskSaved();
          }}
        />
      )}
      {vitalsDialogCase && (
        <RecordVitalsDialog
          key={vitalsDialogCase.id}
          detail={detail ?? vitalsDialogCase}
          onClose={() => {
            setVitalsDialogCase(null);
            recordVitalsRef.current?.focus();
          }}
          onSaved={() => {
            setVitalsDialogCase(null);
            recordVitalsRef.current?.focus();
            showToast("Vitals recorded");
            setAssessmentRevision(count => count + 1);
            onVitalsSaved();
          }}
          onUnavailable={() => {
            setAssessmentRevision(count => count + 1);
            onVitalsSaved();
          }}
        />
      )}
      {painDialogCase && (
        <RecordPainScoreDialog
          key={painDialogCase.id}
          detail={detail ?? painDialogCase}
          onClose={() => {
            setPainDialogCase(null);
            recordPainRef.current?.focus();
          }}
          onSaved={() => {
            setPainDialogCase(null);
            recordPainRef.current?.focus();
            showToast("Pain score recorded");
            setAssessmentRevision(count => count + 1);
            onPainScoreSaved();
          }}
          onUnavailable={() => {
            setAssessmentRevision(count => count + 1);
            onPainScoreSaved();
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

interface TaskDialogProps {
  kind: TaskDialogKind;
  detail: CaseDetail;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function TaskDialog({ kind, detail, onClose, onSaved }: TaskDialogProps) {
  return kind === "addTask"
    ? <AddTaskDialog detail={detail} onClose={onClose} onSaved={onSaved} />
    : <DueItemDialog detail={detail} type={kind} onClose={onClose} onSaved={onSaved} />;
}

interface OverviewProps {
  detail: CaseDetail;
  nameRef: RefObject<HTMLHeadingElement | null>;
  onCompleteTriage: () => void;
  onAddTask: () => void;
  onSetDue: (type: DueItemType) => void;
  onTaskSaved: () => void;
  onRecordVitals: () => void;
  recordVitalsRef: RefObject<HTMLButtonElement | null>;
  onRecordPain: () => void;
  recordPainRef: RefObject<HTMLButtonElement | null>;
  onOpenReview: (kind: ReviewKind) => void;
  clinicalRef: RefObject<HTMLButtonElement | null>;
  medicationsRef: RefObject<HTMLButtonElement | null>;
  timelineRef: RefObject<HTMLButtonElement | null>;
}

function Overview({ detail, nameRef, onCompleteTriage, onAddTask, onSetDue, onTaskSaved, onRecordVitals, recordVitalsRef, onRecordPain, recordPainRef, onOpenReview, clinicalRef, medicationsRef, timelineRef }: OverviewProps) {
  const now = useNow();
  const { patient, owner } = detail;
  const kind = speciesKind(patient.species);
  const meta = [patient.species, patient.breed, longAgeLabel(patient.dateOfBirth, now), weightLabel(detail.weightKg)]
    .filter(Boolean)
    .join(" · ");
  const vitals = detail.vitals[0];
  const observations = [
    { label: "Mucous membrane colour", value: vitals?.mucousMembraneColor },
    { label: "Capillary refill time", value: vitals?.capillaryRefillTime },
    { label: "Mentation", value: vitals?.mentation }
  ];
  const tiles: { field: VitalName; label: string; value: string | null }[] = [
    { field: "heartRate", label: "Heart rate", value: vitals?.heartRate == null ? null : `${vitals.heartRate} bpm` },
    { field: "respiratoryRate", label: "Resp rate", value: vitals?.respiratoryRate == null ? null : `${vitals.respiratoryRate} /min` },
    { field: "temperatureF", label: "Temp", value: temperatureLabel(vitals?.temperatureF ?? null) },
    { field: "spO2", label: "SpO₂", value: vitals?.spO2 == null ? null : `${vitals.spO2}%` }
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

      <section className={styles.reviewActions} aria-label="Patient record">
        <h3 className={styles.sectionTitle}>Patient record</h3>
        <div className={styles.reviewGrid}>
          <button ref={clinicalRef} type="button" className={styles.reviewButton} onClick={() => onOpenReview("clinical")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" /></svg>
            Clinical
          </button>
          <button ref={medicationsRef} type="button" className={styles.reviewButton} onClick={() => onOpenReview("medications")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5l9 9a5 5 0 0 1-7 7l-9-9a5 5 0 0 1 7-7ZM7 16l9-9" /></svg>
            Medications
          </button>
          <button ref={timelineRef} type="button" className={styles.reviewButton} onClick={() => onOpenReview("timeline")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a8 8 0 1 1 2 6M4 5v6h6M12 7v5l3 2" /></svg>
            Timeline
          </button>
        </div>
      </section>

      <section className={styles.vitalsSection} aria-label="Vitals">
        <div className={styles.sectionTop}>
          <h3 className={styles.sectionTitle}>Vitals</h3>
          <button ref={recordVitalsRef} type="button" className={styles.linkButton}
            disabled={detail.dischargedAt !== null} onClick={onRecordVitals}>Record vitals</button>
        </div>
        <dl className={styles.vitals} aria-label="Latest vitals">
          {tiles.map(({ field, label, value }) => (
            <div key={field} className={styles.vital}>
              <dt className={styles.vitalLabel}>{label}</dt>
              <dd className={styles.vitalValue} data-alert={value !== null && vitals?.outOfRange.includes(field)}>
                {value ?? notRecorded}
                {value !== null && vitals?.outOfRange.includes(field) && (
                  <span className={styles.vitalAlert}>Outside range</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <dl className={styles.observations} aria-label="Latest observations">
          {observations.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? notRecorded}</dd>
            </div>
          ))}
        </dl>
        {vitals && <p className={styles.vitalsRecorded}>
          Recorded <time dateTime={vitals.recordedAt}>{timeLabel(vitals.recordedAt, now)}</time>
          {vitals.recordedBy && <> · {vitals.recordedBy.name}</>}
        </p>}
      </section>

      <PainScorePanel score={detail.latestPainScore} now={now} onRecord={onRecordPain}
        disabled={detail.dischargedAt !== null} recordRef={recordPainRef} />

      <div className={styles.locationSection}>
        <p className={styles.row}>
          <span aria-hidden="true">📍</span>
          <span className={styles.rowLabel}>Location</span>
          <span className={styles.rowMeta}>{locationLabel(detail.room)}</span>
        </p>
        <DueRow
          icon="⏱"
          label="Next reassessment"
          caseId={detail.id}
          item={detail.nextReassessment}
          now={now}
          onSet={() => onSetDue("reassessment")}
          onTaskSaved={onTaskSaved}
        />
        <DueRow
          icon="☎"
          label="Client update"
          caseId={detail.id}
          item={detail.nextClientUpdate}
          now={now}
          onSet={() => onSetDue("clientUpdate")}
          onTaskSaved={onTaskSaved}
        />
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
          <button type="button" className={styles.linkButton} onClick={onAddTask}>＋ Add task</button>
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
  caseId: string;
  item: CaseDueItem | null;
  now: Date;
  onSet: () => void;
  onTaskSaved: () => void;
}

// The prototype's "Next reassessment" and "Client update" rows (4.4b). An
// overdue time says so in words as well as colour. Set opens the due item
// dialog; once one is scheduled, Done completes it and the next one due
// takes its place (4.4c). One button for both, so focus stays on it when
// Done turns back into Set. While saving it is aria-disabled, not disabled:
// the browser takes focus away from a disabled button.
function DueRow({ icon, label, caseId, item, now, onSet, onTaskSaved }: DueRowProps) {
  const leaveWhenRefused = useLeaveWhenRefused();
  const showToast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const dueAt = item?.dueAt ?? null;
  const name = label.toLowerCase();

  async function complete(itemId: string) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await completeTask(caseId, itemId);
    } catch (saveError) {
      if (leaveWhenRefused(saveError)) {
        return;
      }

      showToast("Couldn't update the task. Try again.");
    } finally {
      setIsSaving(false);
    }

    onTaskSaved();
  }

  return (
    <p className={styles.row}>
      <span aria-hidden="true">{icon}</span>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowMeta} data-overdue={isOverdue(dueAt, now)}>{dueLabel(dueAt, now)}</span>
      <button
        type="button"
        className={`${styles.linkButton} ${styles.rowAction}`}
        aria-label={item ? `Mark ${name} done` : `Set ${name}`}
        aria-disabled={isSaving || undefined}
        onClick={() => (item ? void complete(item.id) : onSet())}
      >
        {item ? "Done" : "Set"}
      </button>
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
