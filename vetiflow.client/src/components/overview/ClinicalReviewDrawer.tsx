import { useEffect, useId, useRef, type RefObject } from "react";
import type { CaseDetail } from "../../types/CaseDetail";
import { useNow } from "../board/useNow";
import { temperatureLabel, timeLabel } from "./overviewFormat";
import styles from "./ClinicalReviewDrawer.module.scss";

interface ClinicalReviewDrawerProps {
  detail: CaseDetail;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  fallbackRef: RefObject<HTMLHeadingElement | null>;
}

export function ClinicalReviewDrawer({ detail, onClose, triggerRef, fallbackRef }: ClinicalReviewDrawerProps) {
  const id = useId();
  const now = useNow();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
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

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const fallback = fallbackRef.current;
    active.current = true;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      active.current = false;
      if (dialog?.open) dialog.close();
      const target = trigger?.isConnected ? trigger : fallback;
      if (target?.isConnected) target.focus();
    };
  }, [triggerRef, fallbackRef]);

  return (
    <dialog ref={dialogRef} className={styles.drawer} aria-labelledby={`${id}-title`} aria-describedby={`${id}-patient`}
      onClose={event => { if (active.current && !event.currentTarget.open) onClose(); }}
      onCancel={event => { event.preventDefault(); dialogRef.current?.close(); }}>
      <header className={styles.head}>
        <div>
          <h2 id={`${id}-title`}>Clinical</h2>
          <p id={`${id}-patient`}>{detail.patient.name} · Case {detail.caseNumber}</p>
        </div>
        <button ref={closeRef} type="button" className={styles.close} aria-label="Close Clinical"
          onClick={() => dialogRef.current?.close()}>Close</button>
      </header>
      <div className={styles.body}>
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
      </div>
    </dialog>
  );
}
