import { useId } from "react";
import type { CaseDetail } from "../../types/CaseDetail";
import styles from "./MedicationReview.module.scss";

// The Orders & Medications tab of the patient record (3.2c). Orders are not
// recorded in VetiFlow yet (4.18), so the tab says so rather than show an
// empty list that looks complete.
export function MedicationReview({ detail }: { detail: CaseDetail }) {
  const id = useId();
  const sources = [
    { title: "Recorded at intake", text: detail.medicationsAtIntake,
      note: "Recorded for this encounter at intake." },
    { title: "Patient record", text: detail.patient.currentMedications,
      note: "Stored patient history does not confirm current use at this encounter." }
  ];

  return (
    <>
      <p className={styles.meta}>No orders are recorded in VetiFlow yet.</p>
      <p className={styles.status}>Reconciliation status: Unknown (verification not recorded)</p>
      {sources.map((source, index) => (
        <section key={source.title} aria-labelledby={`${id}-source-${index}`}>
          <h3 id={`${id}-source-${index}`}>{source.title}</h3>
          <p className={styles.meta}>{source.note}</p>
          <p className={styles.text}>{source.text?.trim() ? source.text : "Not recorded; medication use unknown"}</p>
        </section>
      ))}
    </>
  );
}
