import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { SessionBar } from "../components/auth/SessionBar";
import { WorkflowLane } from "../components/clinical/WorkflowLane";
import { ErBoardStatusBar } from "../components/clinical/ErBoardStatusBar";
import type {
  CaseStage,
  EmergencyCaseListItem
} from "../types/EmergencyCaseListItem";

import type { SignedInUser } from "../types/Auth";
import { AccessDeniedError, SessionEndedError } from "../services/apiErrors";
import { getEmergencyCases } from "../services/casesApi";
import { clearAccessToken } from "../services/session";
import { createCaseHubConnection } from "../services/caseHub";
import styles from "./ErBoardPage.module.scss";

interface WorkflowStage {
  title: string;
  stage: CaseStage;
}

// React 19 moves <title> into the document head, so each page names its own tab.
const pageTitle = <title>ER Board · VetiFlow</title>;

const workflowStages: WorkflowStage[] = [
  { title: "Incoming", stage: "incoming" },
  { title: "Triage", stage: "triage" },
  { title: "Treatment", stage: "treatment" },
  { title: "Diagnostics", stage: "diagnostics" },
  { title: "Recheck", stage: "recheck" },
  { title: "Discharge", stage: "discharge" }
];

interface ErBoardPageProps {
  user: SignedInUser;
}

export function ErBoardPage({ user }: ErBoardPageProps) {
  const navigate = useNavigate();
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
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        // The token expired or was refused while the board was open.
        if (loadError instanceof SessionEndedError) {
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else if (loadError instanceof AccessDeniedError) {
          navigate("/pet-parent", { replace: true });
        } else {
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
  }, [navigate]);

  if (isLoading) {
    return (
      <main>
        {pageTitle}
        Loading emergency cases...
      </main>
    );
  }

  if (error) {
    return (
      <main>
        {pageTitle}
        {error}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {pageTitle}
      <header className={styles.header}>
        <h1 className={styles.title}>VetiFlow ER Board</h1>

        <ErBoardStatusBar cases={cases} />

        <SessionBar user={user} />
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