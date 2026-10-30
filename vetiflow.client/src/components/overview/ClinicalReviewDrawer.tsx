import { useId } from "react";
import { useNow } from "../board/useNow";
import { temperatureLabel, timeLabel } from "./overviewFormat";
import styles from "./ClinicalReviewDrawer.module.scss";
import { CaseReviewDrawer, type ReviewDrawerProps } from "./CaseReviewDrawer";

export function ClinicalReviewDrawer(props: ReviewDrawerProps) {
  const { detail } = props;
  const id = useId();
  const now = useNow();
  const latest = detail.vitals[0];
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
          <p className={styles.meta}>Entered <time dateTime={latest.recordedAt}>{timeLabel(latest.recordedAt, now)}</time>
            {latest.recordedBy && <> · {latest.recordedBy.name}</>}</p>
          <p className={styles.meta}>Measurement time is not available in this record.</p>
        </>}
      </section>
      <section aria-labelledby={`${id}-assessment`}>
        <h3 id={`${id}-assessment`}>Clinical assessment</h3>
        {findings.length === 0
          ? <p className={styles.meta}>{latest ? "No assessment findings recorded in this set" : "No assessment findings recorded"}</p>
          : <dl className={styles.findings}>{findings.map(finding => <div key={finding.label}>
            <dt>{finding.label}</dt><dd>{finding.value}</dd>
          </div>)}</dl>}
      </section>
    </CaseReviewDrawer>
  );
}
