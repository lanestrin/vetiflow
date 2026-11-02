import { useId } from "react";
import { useNow } from "../board/useNow";
import { allergySourceLabels, allergyStatusLabels, intakeAllergyLabel } from "./allergyStatus";
import { dateTimeLabel, temperatureLabel } from "./overviewFormat";
import { EnteredTime, MeasuredTime } from "./RecordedTimes";
import styles from "./ClinicalReviewDrawer.module.scss";
import { CaseReviewDrawer, type ReviewDrawerProps } from "./CaseReviewDrawer";
import { VitalsChangeSummary } from "./VitalsChangeSummary";

export function ClinicalReviewDrawer(props: ReviewDrawerProps) {
  const { detail } = props;
  const id = useId();
  const now = useNow();
  const latest = detail.vitals[0];
  const previous = detail.vitals[1];
  const readings = [
    { label: "Heart rate", value: latest?.heartRate == null ? null : `${latest.heartRate} bpm` },
    { label: "Respiratory rate", value: latest?.respiratoryRate == null ? null : `${latest.respiratoryRate} /min` },
    { label: "Temperature", value: temperatureLabel(latest?.temperatureF ?? null) },
    { label: "SpO₂", value: latest?.spO2 == null ? null : `${latest.spO2}%` }
  ];
  const findings = [
    { label: "Mucous membrane colour", value: latest?.mucousMembraneColor },
    { label: "Capillary refill time", value: latest?.capillaryRefillTime },
    { label: "Mentation", value: latest?.mentation }
  ].filter(finding => finding.value?.trim());

  return (
    <CaseReviewDrawer {...props} title="Clinical">
      <section aria-labelledby={`${id}-vitals`}>
        <h3 id={`${id}-vitals`}>Latest recorded vitals</h3>
        {!latest && <p className={styles.meta}>No vitals recorded</p>}
        <dl className={styles.readings}>
          {readings.map(reading => <div key={reading.label}>
            <dt>{reading.label}</dt><dd>{reading.value ?? "Not recorded"}</dd>
          </div>)}
        </dl>
        {latest && <>
          <p className={styles.meta}><MeasuredTime occurredAt={latest.occurredAt} now={now} withTime /></p>
          <p className={styles.meta}><EnteredTime recordedAt={latest.recordedAt} now={now} /></p>
          {latest.recordedBy && <p className={styles.meta}>Entered by {latest.recordedBy.name}</p>}
        </>}
      </section>
      {latest && <section aria-labelledby={`${id}-changes`}>
        <h3 id={`${id}-changes`}>Since the previous saved set</h3>
        {previous
          ? <VitalsChangeSummary current={latest} previous={previous} now={now} />
          : <p className={styles.meta}>No earlier vitals saved for this case</p>}
      </section>}
      <section aria-labelledby={`${id}-assessment`}>
        <h3 id={`${id}-assessment`}>Clinical assessment</h3>
        {findings.length === 0
          ? <p className={styles.meta}>{latest ? "No assessment findings recorded in this set" : "No assessment findings recorded"}</p>
          : <dl className={styles.findings}>{findings.map(finding => <div key={finding.label}>
            <dt>{finding.label}</dt><dd>{finding.value}</dd>
          </div>)}</dl>}
      </section>
      <AllergyRecord detail={detail} headingId={`${id}-allergies`} />
    </CaseReviewDrawer>
  );
}

// The patient's stored allergy record and this visit's intake (4.12b): the
// status says "verified" only when a verifier and time were recorded.
function AllergyRecord({ detail, headingId }: { detail: ReviewDrawerProps["detail"]; headingId: string }) {
  const { allergyStatus, allergies, allergySource, allergiesVerifiedAt, allergiesVerifiedBy } = detail.patient;
  const verified = allergiesVerifiedAt && allergiesVerifiedBy
    ? `${allergiesVerifiedBy.name} · ${dateTimeLabel(allergiesVerifiedAt)}`
    : "Not verified";

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>Allergies</h3>
      <dl className={styles.findings}>
        <div><dt>Status</dt><dd>{allergyStatusLabels[allergyStatus]}</dd></div>
        <div><dt>Reported allergies</dt><dd>{allergies?.trim() || "None recorded"}</dd></div>
        <div><dt>Source</dt><dd>{allergySource ? allergySourceLabels[allergySource] : "Not recorded"}</dd></div>
        <div><dt>Verified</dt><dd>{verified}</dd></div>
        <div><dt>At this visit's intake</dt><dd>{intakeAllergyLabel(detail)}</dd></div>
      </dl>
    </section>
  );
}
