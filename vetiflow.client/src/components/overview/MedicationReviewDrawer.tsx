import { useId } from "react";
import { CaseReviewDrawer, type ReviewDrawerProps } from "./CaseReviewDrawer";
import styles from "./MedicationReviewDrawer.module.scss";

export function MedicationReviewDrawer(props: ReviewDrawerProps) {
  const id = useId();
  const { detail } = props;
  const sources = [
    { title: "Recorded at intake", text: detail.medicationsAtIntake,
      note: "Recorded for this encounter at intake." },
    { title: "Patient record", text: detail.patient.currentMedications,
      note: "Stored patient history does not confirm current use at this encounter." }
  ];

  return (
    <CaseReviewDrawer {...props} title="Medications">
      <p className={styles.status}>Reconciliation status: Unknown (verification not recorded)</p>
      {sources.map((source, index) => (
        <section key={source.title} aria-labelledby={`${id}-source-${index}`}>
          <h3 id={`${id}-source-${index}`}>{source.title}</h3>
          <p className={styles.meta}>{source.note}</p>
          <p className={styles.text}>{source.text?.trim() ? source.text : "Not recorded; medication use unknown"}</p>
        </section>
      ))}
    </CaseReviewDrawer>
  );
}
