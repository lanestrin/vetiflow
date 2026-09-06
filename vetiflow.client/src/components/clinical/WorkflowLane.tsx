import { CaseCard } from "./CaseCard";
import styles from "./WorkflowLane.module.scss";
import type {
  CaseStage,
  EmergencyCaseListItem
} from "../../types/EmergencyCaseListItem";

interface WorkflowLaneProps {
  title: string;
  stage: CaseStage;
  cases: EmergencyCaseListItem[];
}

export function WorkflowLane({
  title,
  stage,
  cases
}: WorkflowLaneProps) {
  return (
    <section
      className={styles.lane}
      data-stage={stage}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>

        <span className={styles.count}>
          {cases.length}
        </span>
      </header>

      <div className={styles.caseList}>
        {cases.length === 0 ? (
          <p className={styles.empty}>
            No patients
          </p>
        ) : (
          cases.map((emergencyCase) => (
            <CaseCard
              key={emergencyCase.id}
              emergencyCase={emergencyCase}
            />
          ))
        )}
      </div>
    </section>
  );
}