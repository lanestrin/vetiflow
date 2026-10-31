import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { AcuityBadge } from "../clinical/AcuityBadge";
import { stageLabel } from "../board/boardFormat";
import { useNow } from "../board/useNow";
import { AddTaskDialog } from "../tasks/AddTaskDialog";
import { DueItemDialog, type DueItemType } from "../tasks/DueItemDialog";
import { TriageDialog } from "../triage/TriageDialog";
import { RecordVitalsDialog } from "../vitals/RecordVitalsDialog";
import { getCase } from "../../services/casesApi";
import type { CaseDetail, VitalName } from "../../types/CaseDetail";
import { useToast } from "../shell/toastContext";
import { MoreActionsMenu } from "./MoreActionsMenu";
import { CaseTasksDialog } from "./CaseTasksDialog";
import { ClinicalReviewDrawer } from "./ClinicalReviewDrawer";
import { MedicationReviewDrawer } from "./MedicationReviewDrawer";
import { TimelineReviewDrawer } from "./TimelineReviewDrawer";
import {
  checkInLabel,
  dueLabel,
  locationLabel,
  longAgeLabel,
  speciesKind,
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
}

type TaskDialogKind = "addTask" | DueItemType;
type ReviewKind = "clinical" | "medications" | "timeline";

const reviewDrawers = { clinical: ClinicalReviewDrawer, medications: MedicationReviewDrawer, timeline: TimelineReviewDrawer };

const avatars = { dog: "🐕", cat: "🐈", other: "🐾" };

// The prototype's "Patient overview" (build plan 3.2b) for the card selected
// on the board. Complete triage and Re-triage open the triage dialog (4.2b);
// the buttons that later items wire are shown disabled.
export function PatientOverviewPanel({ caseId, refreshedAt, onTriaged, onTaskSaved, onVitalsSaved }: PatientOverviewPanelProps) {
  const titleId = useId();
  const leaveWhenRefused = useLeaveWhenRefused();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const moreActionsRef = useRef<HTMLButtonElement>(null);
  const clinicalRef = useRef<HTMLButtonElement>(null);
  const medicationsRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [assessmentRevision, setAssessmentRevision] = useState(0);
  const showToast = useToast();
  const [isTriaging, setIsTriaging] = useState(false);
  const [taskDialog, setTaskDialog] = useState<TaskDialogKind | null>(null);
  const [isTaskReviewOpen, setIsTaskReviewOpen] = useState(false);
  const [vitalsDialogCase, setVitalsDialogCase] = useState<CaseDetail | null>(null);
  const [review, setReview] = useState<{ caseId: string; kind: ReviewKind } | null>(null);
  // A dialog for one case never carries over to the next selection.
  const [dialogCaseId, setDialogCaseId] = useState(caseId);
  if (dialogCaseId !== caseId) {
    setDialogCaseId(caseId);
    setIsTriaging(false);
    setTaskDialog(null);
    setIsTaskReviewOpen(false);
    setVitalsDialogCase(null);
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
            actionButtonRef={moreActionsRef}
            actions={[
              {
                label: detail.stage === "incoming" ? "Complete triage" : "Re-triage",
                onSelect: () => setIsTriaging(true)
              },
              { label: "Tasks and due items", onSelect: () => setIsTaskReviewOpen(true) },
              ...(detail.dischargedAt === null
                ? [
                    { label: "Add task", onSelect: () => setTaskDialog("addTask") },
                    { label: "Set reassessment", onSelect: () => setTaskDialog("reassessment") },
                    { label: "Set client update", onSelect: () => setTaskDialog("clientUpdate") }
                  ]
                : []),
              {
                label: "Record vitals",
                disabled: detail.dischargedAt !== null,
                onSelect: () => setVitalsDialogCase(detail)
              }
            ]}
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
      {detail && isTaskReviewOpen && (
        <CaseTasksDialog
          detail={detail}
          triggerRef={moreActionsRef}
          fallbackRef={headingRef}
          onClose={() => setIsTaskReviewOpen(false)}
          onTaskSaved={onTaskSaved}
        />
      )}
      {detail && isTriaging && (
        <TriageDialog
          detail={detail}
          onClose={() => {
            setIsTriaging(false);
            moreActionsRef.current?.focus();
          }}
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
          onClose={() => {
            setTaskDialog(null);
            moreActionsRef.current?.focus();
          }}
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
            moreActionsRef.current?.focus();
          }}
          onSaved={() => {
            setVitalsDialogCase(null);
            moreActionsRef.current?.focus();
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
  onOpenReview: (kind: ReviewKind) => void;
  clinicalRef: RefObject<HTMLButtonElement | null>;
  medicationsRef: RefObject<HTMLButtonElement | null>;
  timelineRef: RefObject<HTMLButtonElement | null>;
}

function Overview({ detail, nameRef, onOpenReview, clinicalRef, medicationsRef, timelineRef }: OverviewProps) {
  const now = useNow();
  const { patient, owner } = detail;
  const kind = speciesKind(patient.species);
  const meta = [patient.species, patient.breed, longAgeLabel(patient.dateOfBirth, now), weightLabel(detail.weightKg)]
    .filter(Boolean)
    .join(" · ");
  const vitals = detail.vitals[0];
  const tiles: { field: VitalName; label: string; value: string }[] = [
    { field: "heartRate", label: "Heart rate", value: vitals?.heartRate == null ? "Not recorded" : `${vitals.heartRate} bpm` },
    { field: "respiratoryRate", label: "Resp rate", value: vitals?.respiratoryRate == null ? "Not recorded" : `${vitals.respiratoryRate} /min` },
    { field: "temperatureF", label: "Temp", value: temperatureLabel(vitals?.temperatureF ?? null) ?? "Not recorded" },
    { field: "spO2", label: "SpO₂", value: vitals?.spO2 == null ? "Not recorded" : `${vitals.spO2}%` }
  ];
  const allergy = [...new Set([detail.allergiesAtIntake, patient.allergies]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value)))];
  const lastUpdate = detail.lastOwnerUpdateAt
    ? `Last recorded owner update: ${timeLabel(detail.lastOwnerUpdateAt, now)}`
    : "Last recorded owner update: Not recorded";
  const nextUpdate = detail.nextClientUpdate
    ? `${detail.nextClientUpdate.description} · ${dueLabel(detail.nextClientUpdate.dueAt, now)}`
    : "Not scheduled";

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

      <section className={styles.summary} aria-label="Current patient status">
        <div className={styles.summaryRow}>
          <h3>Presenting complaint</h3>
          <p>{detail.presentingComplaint.trim() || "Not recorded"}</p>
        </div>
        <div className={styles.summaryRow}>
          <h3>Care stage</h3>
          <p>{stageLabel(detail.stage)}</p>
        </div>
        <div className={styles.summaryRow}>
          <h3>Current location</h3>
          <p>{locationLabel(detail.room)}</p>
        </div>
        <div className={styles.summaryRow}>
          <h3>Next documented action</h3>
          <p>{detail.nextAction?.trim() || "No next action documented"}</p>
          <small>Action assignee: Not recorded</small>
        </div>
        <div className={styles.summaryRow}>
          <h3>Next reassessment</h3>
          <p>{detail.nextReassessment
            ? `${detail.nextReassessment.description} · ${dueLabel(detail.nextReassessment.dueAt, now)}`
            : "Not scheduled"}</p>
          {detail.nextReassessment?.assignedTo && <small>Assigned to {detail.nextReassessment.assignedTo.name}</small>}
        </div>
      </section>

      <section className={styles.vitalsSection} aria-label="Latest vitals">
        <h3 className={styles.sectionTitle}>Latest vitals</h3>
        <dl className={styles.vitals} aria-label="Latest vitals">
          {tiles.map(({ field, label, value }) => (
            <div key={field} className={styles.vital}>
              <dt className={styles.vitalLabel}>{label}</dt>
              <dd className={styles.vitalValue}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.vitalsRecorded}>
          {vitals
            ? <>Entered <time dateTime={vitals.recordedAt}>{timeLabel(vitals.recordedAt, now)}</time>{vitals.recordedBy && <> · {vitals.recordedBy.name}</>}</>
            : "No vitals recorded"}
        </p>
      </section>

      <section className={styles.summary} aria-label="Safety and coordination">
        <div className={styles.summaryRow}>
          <h3>Allergy status</h3>
          <p>{allergy.length > 0
            ? `${allergy.join(" · ")} · verification unknown`
            : "Unknown / not verified"}</p>
        </div>
        <div className={styles.summaryRow}>
          <h3>Attending veterinarian</h3>
          <p data-role="attending-veterinarian">{detail.assignedDoctor?.name ?? "Unassigned"}</p>
        </div>
        <div className={styles.summaryRow}>
          <h3>Primary technician</h3>
          <p data-role="primary-technician">{detail.assignedTechnician?.name ?? "Not assigned"}</p>
        </div>
        <div className={styles.summaryRow}>
          <h3>Client communication</h3>
          <p>{lastUpdate}</p>
          <small>Update status: {ownerUpdateLabel(detail.ownerUpdateStatus)}</small>
          <small>Next planned update: {nextUpdate}</small>
        </div>
      </section>

      <p className={styles.communicationNote}>Approved client-facing update: Not available in this record.</p>
    </>
  );
}

function ownerUpdateLabel(status: CaseDetail["ownerUpdateStatus"]): string {
  const labels = {
    notYetUpdated: "No recorded update status",
    updated: "Update status recorded",
    awaitingOwnerReply: "Awaiting owner reply",
    consentNeeded: "Consent needed"
  } satisfies Record<CaseDetail["ownerUpdateStatus"], string>;

  return labels[status];
}
