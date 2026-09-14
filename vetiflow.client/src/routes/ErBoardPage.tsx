import { useEffect, useState } from "react";
import { WorkflowLane } from "../components/clinical/WorkflowLane";
import { ErBoardStatusBar } from "../components/clinical/ErBoardStatusBar";
import type {
  CaseStage,
  EmergencyCaseListItem
} from "../types/EmergencyCaseListItem";

import { getEmergencyCases } from "../services/casesApi";
import { createCaseHubConnection } from "../services/caseHub";
import styles from "./ErBoardPage.module.scss";

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
    let isActive = true;

    const connection = createCaseHubConnection();

    async function loadCases() {
      try {
        const emergencyCases = await getEmergencyCases();

        if (!isActive) {
          return;
        }

        setCases(emergencyCases);
        setError(null);
      } catch {
        if (isActive) {
          setError("Unable to load emergency cases.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    connection.on("caseUpdated", () => {
      void loadCases();
    });

    async function startLiveUpdates() {
      try {
        await connection.start();
      } catch (connectionError) {
        console.error(
          "Unable to connect to live case updates.",
          connectionError
        );
      }
    }

    void loadCases();
    void startLiveUpdates();

    return () => {
      isActive = false;
      connection.off("caseUpdated");
      void connection.stop();
    };
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

        <ErBoardStatusBar cases={cases} />
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