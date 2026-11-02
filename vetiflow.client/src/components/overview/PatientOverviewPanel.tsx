import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { AcuityBadge } from "../clinical/AcuityBadge";
import { stageLabel } from "../board/boardFormat";
import { useNow } from "../board/useNow";
import { AddTaskDialog } from "../tasks/AddTaskDialog";
import { DueItemDialog, type DueItemType } from "../tasks/DueItemDialog";
import { TriageDialog } from "../triage/TriageDialog";
import { UpdateStatusDialog } from "../status/UpdateStatusDialog";
import { RecordVitalsDialog } from "../vitals/RecordVitalsDialog";
import { getCase } from "../../services/casesApi";
import type { CaseDetail, VitalName } from "../../types/CaseDetail";
import type { PatientProfileRouteState } from "../../routes/PatientProfilePage";
import { useToast } from "../shell/toastContext";
import { allergySummary } from "./allergyStatus";
import { MoreActionsMenu } from "./MoreActionsMenu";
import { CaseTasksDialog } from "./CaseTasksDialog";
import { ChangeLocationDialog } from "./ChangeLocationDialog";
import { EditCareTeamDialog } from "./EditCareTeamDialog";
import { ClinicalReview } from "./ClinicalReview";
import { MedicationReview } from "./MedicationReview";
import { TimelineReview } from "./TimelineReview";
import { EnteredTime, MeasuredTime } from "./RecordedTimes";
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
  caseUnavailable?: boolean;
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
// The quick edits opened from the overview itself (build plan 4.3b).
type QuickEdit = "location" | "careTeam" | "stage";

// The patient record's tabs (build plan 3.2c, product rules section 4).
type RecordTab = "overview" | "clinical" | "orders" | "timeline";
const recordTabs: { key: RecordTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "clinical", label: "Clinical" },
  { key: "orders", label: "Orders & Medications" },
  { key: "timeline", label: "Timeline" }
];

const avatars = { dog: "🐕", cat: "🐈", other: "🐾" };

// The prototype's patient record (build plan 3.2b, 3.2c) for the case selected
// on the board: a fixed header with who the patient is, their acuity, care
// stage, location and allergies, above the Overview, Clinical, Orders &
// Medications and Timeline tabs. Complete triage and Re-triage open the triage
// dialog (4.2b).

export function PatientOverviewPanel({ caseId, caseUnavailable = false, refreshedAt, onTriaged, onTaskSaved, onVitalsSaved }: PatientOverviewPanelProps) {
  const titleId = useId();
  const leaveWhenRefused = useLeaveWhenRefused();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const moreActionsRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [assessmentRevision, setAssessmentRevision] = useState(0);
  const showToast = useToast();
  const [editingCase, setEditingCase] = useState<CaseDetail | null>(null);
  const [isTriaging, setIsTriaging] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [taskDialog, setTaskDialog] = useState<TaskDialogKind | null>(null);
  const [isTaskReviewOpen, setIsTaskReviewOpen] = useState(false);
  const [vitalsDialogCase, setVitalsDialogCase] = useState<CaseDetail | null>(null);
  const [quickEdit, setQuickEdit] = useState<"location" | "careTeam" | null>(null);
  // The button a quick edit or Update status was opened from, for focus on close.
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  // A new selection opens on Overview; a refresh of the same case keeps the tab.
  const [tab, setTab] = useState<RecordTab>("overview");
  // A dialog for one case never carries over to the next selection.
  const [dialogCaseId, setDialogCaseId] = useState(caseId);
  if (dialogCaseId !== caseId) {
    setDialogCaseId(caseId);
    setEditingCase(null);
    setIsTriaging(false);
    setIsUpdatingStatus(false);
    setTaskDialog(null);
    setIsTaskReviewOpen(false);
    setVitalsDialogCase(null);
    setTab("overview");
    setQuickEdit(null);
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
        if (isActive) {
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
  const draftDetail = detail ?? editingCase;
  const unavailable = caseUnavailable || result?.kind === "notFound";

  function returnFocus() {
    const trigger = returnFocusRef.current;
    (trigger?.isConnected ? trigger : moreActionsRef.current)?.focus();
  }

  function openQuickEdit(kind: QuickEdit, trigger: HTMLButtonElement) {
    if (!detail) return;
    returnFocusRef.current = trigger;
    setEditingCase(detail);
    if (kind === "stage") setIsUpdatingStatus(true);
    else setQuickEdit(kind);
  }

  function quickEditSaved(message: string) {
    // Closed here as well as by the dialog's close event (as triage).
    setQuickEdit(null);
    returnFocus();
    showToast(message);
    // The board reload also reloads this panel, so the saved values show.
    onTaskSaved();
  }

  return (
    <aside className={styles.panel} aria-labelledby={titleId} aria-busy={caseId !== null && result === null}>
      {/* Stays at the top while the tab content scrolls (3.2c). */}
      <div className={styles.fixedTop}>
        <header className={styles.head}>
          <div>
            <h2 ref={headingRef} tabIndex={-1} id={titleId} className={styles.title}>Patient record</h2>
            {detail && <CaseLine detail={detail} />}
          </div>
          {detail && (
            <MoreActionsMenu
              actionButtonRef={moreActionsRef}
              actions={[
                {
                  label: detail.stage === "incoming" ? "Complete triage" : "Re-triage",
                  onSelect: () => { setEditingCase(detail); setIsTriaging(true); }
                },
                { label: "Update status", onSelect: () => { returnFocusRef.current = moreActionsRef.current; setEditingCase(detail); setIsUpdatingStatus(true); } },
                { label: "Tasks and due items", onSelect: () => setIsTaskReviewOpen(true) },
                ...(detail.dischargedAt === null
                  ? [
                      { label: "Add task", onSelect: () => { setEditingCase(detail); setTaskDialog("addTask"); } },
                      { label: "Set reassessment", onSelect: () => { setEditingCase(detail); setTaskDialog("reassessment"); } },
                      { label: "Set client update", onSelect: () => { setEditingCase(detail); setTaskDialog("clientUpdate"); } }
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
        {detail && <PatientHeader detail={detail} nameRef={nameRef} onQuickEdit={openQuickEdit} />}
        {detail && <RecordTabs idBase={titleId} tab={tab} onChange={setTab} />}
      </div>

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
        <div
          id={`${titleId}-${tab}-panel`}
          role="tabpanel"
          aria-labelledby={`${titleId}-${tab}-tab`}
          tabIndex={0}
          className={styles.tabPanel}
        >
          {tab === "overview" && <Overview detail={detail} onQuickEdit={openQuickEdit} />}
          {tab === "clinical" && <div className={styles.review}><ClinicalReview detail={detail} /></div>}
          {tab === "orders" && <div className={styles.review}><MedicationReview detail={detail} /></div>}
          {tab === "timeline" && <div className={styles.review}><TimelineReview detail={detail} /></div>}
        </div>
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
      {draftDetail && isTriaging && (
        <TriageDialog
          caseUnavailable={unavailable}
          detail={draftDetail}
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
      {draftDetail && isUpdatingStatus && (
        <UpdateStatusDialog
          caseUnavailable={unavailable}
          detail={draftDetail}
          onClose={() => {
            setIsUpdatingStatus(false);
            returnFocus();
          }}
          onSaved={(message) => {
            // Closed here as well as by the dialog's close event (as triage).
            setIsUpdatingStatus(false);
            returnFocus();
            showToast(message);
            // The board reload also reloads this panel, so the new stage shows.
            onTaskSaved();
          }}
        />
      )}
      {draftDetail && quickEdit === "location" && (
        <ChangeLocationDialog
          caseUnavailable={unavailable}
          detail={draftDetail}
          onClose={() => {
            setQuickEdit(null);
            returnFocus();
          }}
          onSaved={quickEditSaved}
        />
      )}
      {draftDetail && quickEdit === "careTeam" && (
        <EditCareTeamDialog
          caseUnavailable={unavailable}
          detail={draftDetail}
          onClose={() => {
            setQuickEdit(null);
            returnFocus();
          }}
          onSaved={quickEditSaved}
          onPartlySaved={onTaskSaved}
        />
      )}
      {draftDetail && taskDialog !== null && (
        <TaskDialog
          kind={taskDialog}
          caseUnavailable={unavailable}
          detail={draftDetail}
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
          caseUnavailable={unavailable}
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
  caseUnavailable: boolean;
  kind: TaskDialogKind;
  detail: CaseDetail;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function TaskDialog({ kind, caseUnavailable, detail, onClose, onSaved }: TaskDialogProps) {
  return kind === "addTask"
    ? <AddTaskDialog caseUnavailable={caseUnavailable} detail={detail} onClose={onClose} onSaved={onSaved} />
    : <DueItemDialog caseUnavailable={caseUnavailable} detail={detail} type={kind} onClose={onClose} onSaved={onSaved} />;
}

interface PatientHeaderProps {
  detail: CaseDetail;
  nameRef: RefObject<HTMLHeadingElement | null>;
  onQuickEdit: (kind: QuickEdit, trigger: HTMLButtonElement) => void;
}

// The prototype's .patient-sticky: identity, acuity, care stage, location and
// allergies stay in view on every tab (product rules section 4). Stage and
// location open their small edit dialogs (Patient header quick edits).
function PatientHeader({ detail, nameRef, onQuickEdit }: PatientHeaderProps) {
  const now = useNow();
  const { patient } = detail;
  const kind = speciesKind(patient.species);
  const meta = [patient.species, patient.breed, longAgeLabel(patient.dateOfBirth, now), weightLabel(detail.weightKg)]
    .filter(Boolean)
    .join(" · ");
  // A discharged case is read-only, as for tasks.
  const canEdit = detail.dischargedAt === null;
  const fields: { kind: QuickEdit; label: string; value: string; name: string }[] = [
    { kind: "stage", label: "Care stage", value: stageLabel(detail.stage), name: "Change care stage" },
    { kind: "location", label: "Location", value: locationLabel(detail.room), name: "Change location" }
  ];

  return (
    <div className={styles.patientHeader}>
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
      <div className={styles.quickFields}>
        {fields.map(field => canEdit ? (
          <button key={field.kind} type="button" className={styles.quickField}
            aria-label={`${field.name}, currently ${field.value}`}
            onClick={event => onQuickEdit(field.kind, event.currentTarget)}>
            <span className={styles.quickFieldLabel}>{field.label}</span>
            <span className={styles.quickFieldValue}>{field.value}</span>
          </button>
        ) : (
          <p key={field.kind} className={styles.quickField}>
            <span className={styles.quickFieldLabel}>{field.label}</span>
            <span className={styles.quickFieldValue}>{field.value}</span>
          </p>
        ))}
      </div>
      <p className={styles.allergyLine} data-status={patient.allergyStatus}>
        <strong>Allergies:</strong> {allergySummary(detail)}
      </p>
    </div>
  );
}

interface RecordTabsProps {
  // Shared with the tab panel, so each tab names the panel it controls.
  idBase: string;
  tab: RecordTab;
  onChange: (tab: RecordTab) => void;
}

// The prototype's .patient-tabs as a WAI-ARIA tablist: arrows move between
// tabs (wrapping), Home and End go to the first and last.
function RecordTabs({ idBase, tab, onChange }: RecordTabsProps) {
  const tabRefs = useRef<Record<RecordTab, HTMLButtonElement | null>>({ overview: null, clinical: null, orders: null, timeline: null });

  function choose(next: RecordTab) {
    onChange(next);
    tabRefs.current[next]?.focus();
  }

  function moveWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    const index = recordTabs.findIndex(item => item.key === tab);
    const last = recordTabs.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    choose(recordTabs[next].key);
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Patient record sections" onKeyDown={moveWithKeys}>
      {recordTabs.map(item => (
        <button
          key={item.key}
          ref={element => { tabRefs.current[item.key] = element; }}
          id={`${idBase}-${item.key}-tab`}
          type="button"
          role="tab"
          aria-selected={tab === item.key}
          aria-controls={`${idBase}-${item.key}-panel`}
          tabIndex={tab === item.key ? 0 : -1}
          className={styles.tab}
          onClick={() => choose(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface OverviewProps {
  detail: CaseDetail;
  onQuickEdit: (kind: QuickEdit, trigger: HTMLButtonElement) => void;
}

function Overview({ detail, onQuickEdit }: OverviewProps) {
  const now = useNow();
  const { patient, owner } = detail;
  const complaint = detail.presentingComplaint.trim() || "Not recorded";
  const vitals = detail.vitals[0];
  const tiles: { field: VitalName; label: string; value: string }[] = [
    { field: "heartRate", label: "Heart rate", value: vitals?.heartRate == null ? "Not recorded" : `${vitals.heartRate} bpm` },
    { field: "respiratoryRate", label: "Resp rate", value: vitals?.respiratoryRate == null ? "Not recorded" : `${vitals.respiratoryRate} /min` },
    { field: "temperatureF", label: "Temp", value: temperatureLabel(vitals?.temperatureF ?? null) ?? "Not recorded" },
    { field: "spO2", label: "SpO₂", value: vitals?.spO2 == null ? "Not recorded" : `${vitals.spO2}%` }
  ];
  const lastUpdate = detail.lastOwnerUpdateAt ? timeLabel(detail.lastOwnerUpdateAt, now) : "Not recorded";
  // A discharged case is read-only, as for tasks.
  const canEdit = detail.dischargedAt === null;
  const quickEditButton = (kind: "careTeam", label: string, name: string) => canEdit && (
    <button type="button" className={styles.quickEdit} aria-label={name}
      onClick={event => onQuickEdit(kind, event.currentTarget)}>
      {label}
    </button>
  );
  const nextUpdate = detail.nextClientUpdate
    ? `${detail.nextClientUpdate.description} · ${dueLabel(detail.nextClientUpdate.dueAt, now)}`
    : "Not scheduled";

  return (
    <>
      <section className={styles.caseContext} aria-label="Case context">
        <div className={styles.complaint}>
          <h3 className={styles.kicker}>
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18h6M10 22h4M9 14a6 6 0 1 1 6 0c-1.2 1-1.7 2-1.7 4h-2.6c0-2-.5-3-1.7-4Z" />
            </svg>
            Presenting complaint
          </h3>
          <p className={styles.complaintValue}>{complaint}</p>
        </div>
      </section>

      <section className={styles.nextAction} aria-label="Next care action">
        <h3 className={styles.kicker}>
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 2 21h20L12 3Z" />
            <path d="M12 9v5m0 3h.01" />
          </svg>
          Next care action
        </h3>
        <p className={styles.actionValue}>{detail.nextAction?.trim() || "No next action documented"}</p>
        <div className={styles.actionRow}>
          <span>Responsible</span>
          <strong>Not recorded</strong>
        </div>
        <div className={styles.actionRow}>
          <span>Next reassessment</span>
          <div>
            <strong>{detail.nextReassessment
              ? `${detail.nextReassessment.description} · ${dueLabel(detail.nextReassessment.dueAt, now)}`
              : "Not scheduled"}</strong>
            {detail.nextReassessment?.assignedTo && (
              <small>Assigned to {detail.nextReassessment.assignedTo.name}</small>
            )}
          </div>
        </div>
        <div className={styles.actionRow}>
          <span>Last owner update</span>
          <div>
            <strong>{lastUpdate}</strong>
            <small>Update status: {ownerUpdateLabel(detail.ownerUpdateStatus)}</small>
          </div>
        </div>
        <div className={styles.actionRow}>
          <span>Next client update</span>
          <strong>{nextUpdate}</strong>
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
            ? <><MeasuredTime occurredAt={vitals.occurredAt} now={now} /> · <EnteredTime recordedAt={vitals.recordedAt} now={now} />
              {vitals.recordedBy && <> · {vitals.recordedBy.name}</>}</>
            : "No vitals recorded"}
        </p>
      </section>

      <section className={styles.careContext} aria-label="Care team and safety">
        <div className={styles.careContextHead}>
          <h3 className={styles.careContextTitle}>
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              <path d="M9 12h6m-3-3v6" />
            </svg>
            Care team &amp; safety
          </h3>
          {quickEditButton("careTeam", "Edit care team", "Edit care team")}
        </div>
        <div className={styles.contextRow}>
          <span>Allergies</span>
          <strong data-role="allergies">{allergySummary(detail)}</strong>
        </div>
        <div className={styles.contextRow}>
          <span>Attending veterinarian</span>
          <strong data-role="attending-veterinarian">{detail.assignedDoctor?.name ?? "Not assigned"}</strong>
        </div>
        <div className={styles.contextRow}>
          <span>Primary technician</span>
          <strong data-role="primary-technician">{detail.assignedTechnician?.name ?? "Not assigned"}</strong>
        </div>
        <div className={styles.contextRow}>
          <span>Pet parent</span>
          <strong>{owner ? `${owner.firstName} ${owner.lastName}` : "No pet parent recorded"}</strong>
        </div>
      </section>

      {/* Earlier visits open on the patient's profile (4.21c); the tabs stay on this visit. */}
      <Link
        to={`/records/${patient.id}`}
        state={{ fromErBoard: { caseId: detail.id } } satisfies PatientProfileRouteState}
        className={styles.historyLink}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2" /><circle cx="16" cy="16" r="5" /><path d="M16 13.5V16l1.5 1.5" /></svg>
        View Patient History
        <svg className={styles.historyArrow} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9 8h7v7" /></svg>
      </Link>
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
