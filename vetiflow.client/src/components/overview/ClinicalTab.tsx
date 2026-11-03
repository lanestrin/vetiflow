import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { useNow } from "../board/useNow";
import type { CaseDetail } from "../../types/CaseDetail";
import { allergyStatusLabels } from "./allergyStatus";
import { AllergyRecord, RecordedVitalsAndAssessment } from "./ClinicalReview";
import { lastUpdatedLabel, recordTimeLabel, timeLabel } from "./overviewFormat";
import styles from "./ClinicalTab.module.scss";

// Why each unavailable control does nothing yet, naming the build item that
// enables it. That item replaces the control with the real action.
const reasons = {
  draft: "Available when clinical drafts are saved in VetiFlow (4.15b).",
  signOff: "Available when clinical note signing is built (4.15d).",
  reviewRequest: "Available when vet review requests are built (4.16b).",
  diagnostic: "Available when diagnostics are tracked (4.20b).",
  handoff: "Available when handoffs are recorded (6.1b).",
  discharge: "Available when discharge authorization is built (6.2b)."
};

interface ClinicalTabProps {
  detail: CaseDetail;
  // The header's allergy indicator asked for the allergy details (3.2e).
  showAllergies: boolean;
  onAllergiesShown: () => void;
}

// The patient record's Clinical tab in Clinical.png's layout (3.2e): the vet's
// examination and treatment plan workspace, then documentation, review
// requests, diagnostics, handoff and discharge, then the recorded vitals and
// allergy record in disclosures. Nothing here saves yet.
export function ClinicalTab({ detail, showAllergies, onAllergiesShown }: ClinicalTabProps) {
  const id = useId();
  const now = useNow();
  const allergyDetailsRef = useRef<HTMLDetailsElement>(null);
  const allergySummaryRef = useRef<HTMLElement>(null);
  const latest = detail.vitals[0];
  const measured = latest ? recordTimeLabel(latest.occurredAt, now) : null;
  const vitalsSummary = !latest ? "None recorded" : measured ?? "Time unknown";

  useEffect(() => {
    if (!showAllergies || !allergyDetailsRef.current) return;
    allergyDetailsRef.current.open = true;
    allergyDetailsRef.current.scrollIntoView?.({ block: "start" });
    allergySummaryRef.current?.focus();
    onAllergiesShown();
  }, [showAllergies, onAllergiesShown]);

  return (
    <div className={styles.clinical}>
      <section className={styles.careSection} aria-labelledby={`${id}-exam`}>
        <div className={styles.between}>
          <h3 id={`${id}-exam`} className={styles.sectionTitle}>Examination &amp; treatment plan</h3>
          <span className={styles.chip}>Vet workspace</span>
        </div>
        <div className={styles.form}>
          <label>
            Assessment / examination
            <textarea placeholder="Findings and clinical assessment" disabled title={reasons.draft} aria-describedby={`${id}-hint`} />
          </label>
          <label>
            Clinical plan
            <textarea placeholder="Plan and follow-up" disabled title={reasons.draft} aria-describedby={`${id}-hint`} />
          </label>
          <label>
            Assessment event time
            <input type="datetime-local" disabled title={reasons.draft} aria-describedby={`${id}-hint`} />
          </label>
          <p id={`${id}-hint`} className={styles.sub}>Exam and plan drafts can't be saved in VetiFlow yet.</p>
          <div className={styles.actions}>
            <UnavailableButton label="Save draft" reason={reasons.draft} />
            <UnavailableButton label="Sign off" reason={reasons.signOff} primary />
          </div>
        </div>
        <Disclosure title="Signed documentation & nursing notes" value="0">
          <p className={styles.hint}>No signed documentation or nursing notes recorded.</p>
        </Disclosure>
      </section>

      <section className={styles.careSection} aria-labelledby={`${id}-reviews`}>
        <div className={styles.between}>
          <h3 id={`${id}-reviews`} className={styles.sectionTitle}>Vet review requests</h3>
          <UnavailableButton label="＋ Request" reason={reasons.reviewRequest} />
        </div>
        <p className={styles.hint}>No review requests recorded.</p>
      </section>

      <Disclosure title="Diagnostics & follow-up" value="Not tracked yet">
        <UnavailableButton label="Track diagnostic" reason={reasons.diagnostic} />
        <p className={styles.hint}>
          Diagnostics aren't tracked in VetiFlow yet. Diagnostic tasks and blockers are in Tasks and due items.
        </p>
      </Disclosure>
      <Disclosure title="Handoff & escalation" value="Not tracked yet">
        <UnavailableButton label="Record handoff / concern" reason={reasons.handoff} />
        <p className={styles.hint}>
          Handoffs aren't recorded in VetiFlow yet. Urgent concerns require direct communication.
        </p>
      </Disclosure>
      <Disclosure title="Discharge" value={detail.dischargedAt ? `Discharged ${timeLabel(detail.dischargedAt, now)}` : "Not recorded"}>
        <p className={styles.hint}>Medical authorization is separate from preparation, checkout and physical departure.</p>
        <div className={styles.actions}>
          <UnavailableButton label="Review discharge readiness" reason={reasons.discharge} />
        </div>
      </Disclosure>

      <Disclosure title="Recorded vitals & assessment" value={vitalsSummary}>
        <div className={styles.record}><RecordedVitalsAndAssessment detail={detail} /></div>
      </Disclosure>
      <Disclosure
        title="Allergy details"
        value={allergyStatusLabels[detail.patient.allergyStatus]}
        detailsRef={allergyDetailsRef}
        summaryRef={allergySummaryRef}
      >
        <div className={styles.record}><AllergyRecord detail={detail} /></div>
      </Disclosure>

      <p className={styles.saveState}>{lastUpdatedLabel(detail, now)}</p>
    </div>
  );
}

interface DisclosureProps {
  title: string;
  // Shown muted on the right of the summary.
  value: string;
  children: ReactNode;
  detailsRef?: RefObject<HTMLDetailsElement | null>;
  summaryRef?: RefObject<HTMLElement | null>;
}

// The prototype's .wf-disclosure: closed by default, + / − on the right. The
// group is named by its title alone.
function Disclosure({ title, value, children, detailsRef, summaryRef }: DisclosureProps) {
  const titleId = useId();
  return (
    <details ref={detailsRef} className={styles.disclosure} aria-labelledby={titleId}>
      <summary ref={summaryRef}><span id={titleId}>{title}</span> <span className={styles.summaryValue}>{value}</span></summary>
      {children}
    </details>
  );
}

// A control whose back end is not built yet. aria-disabled, not disabled, so
// keyboard and screen-reader users still reach it and hear why.
function UnavailableButton({ label, reason, primary = false }: { label: string; reason: string; primary?: boolean }) {
  const reasonId = useId();
  return (
    <>
      <button type="button" className={styles.button} data-primary={primary || undefined}
        aria-disabled="true" title={reason} aria-describedby={reasonId}>
        {label}
      </button>
      <span id={reasonId} hidden>{reason}</span>
    </>
  );
}
