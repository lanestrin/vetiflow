import { useEffect, useState } from "react";
import { WorkflowLane } from "../components/clinical/WorkflowLane";
import type {
  CaseStage,
  EmergencyCaseListItem
} from "../types/EmergencyCaseListItem";
import styles from "./ErBoardPage.module.scss";
import { getEmergencyCases } from "../types/casesApi";

interface WorkflowStage {
  title: string;
  stage: CaseStage;
}

const workflowStages: WorkflowStage[] = [
  { title: "Incoming", stage: "incoming" },
  { title: "Triage", stage: "triage" },
  { title: "Treatment", stage: "treatment" },
  { title: "Diagnostics", stage: "diagnostics" },
  { title: "Recheck", stage: "recheck" },
  { title: "Discharge", stage: "discharge" }
];

export function ErBoardPage() {
  const [cases, setCases] = useState<EmergencyCaseListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCases() {
      try {
        const emergencyCases = await getEmergencyCases();
        setCases(emergencyCases);
      } catch {
        setError("Unable to load emergency cases.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCases();
  }, []);

  if (isLoading) {
    return <main>Loading emergency cases...</main>;
  }

  if (error) {
    return <main>{error}</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>VetiFlow ER Board</h1>
      </header>

      <div className={styles.board}>
        {workflowStages.map((workflowStage) => {
          const stageCases = cases.filter(
            (emergencyCase) =>
              emergencyCase.stage === workflowStage.stage
          );

          return (
            <WorkflowLane
              key={workflowStage.stage}
              title={workflowStage.title}
              stage={workflowStage.stage}
              cases={stageCases}
            />
          );
        })}
      </div>
    </main>
  );
}