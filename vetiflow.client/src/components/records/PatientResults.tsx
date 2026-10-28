import type { PatientListItem } from "../../types/PatientListItem";
import styles from "./PatientResults.module.scss";

interface PatientResultsProps {
  patients: PatientListItem[];
}

// Records search results for staff. In care shows as words, not colour alone.
// Owner contact details are never in the list.
export function PatientResults({ patients }: PatientResultsProps) {
  return (
    <ul className={styles.list}>
      {patients.map((patient) => (
        <li key={patient.id} className={styles.patient}>
          <h2 className={styles.name}>{patient.name}</h2>
          <p className={styles.detail}>
            {patient.breed ? `${patient.species} · ${patient.breed}` : patient.species}
          </p>
          <p className={styles.detail}>
            {patient.ownerName ? `Owner: ${patient.ownerName}` : "No owner recorded"}
          </p>
          {patient.inCare ? (
            <span className={styles.inCare}>In care</span>
          ) : (
            <span className={styles.notInCare}>Not in care</span>
          )}
        </li>
      ))}
    </ul>
  );
}
