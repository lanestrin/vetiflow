import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { PatientFlowBoard } from "../components/board/PatientFlowBoard";
import { ErBoardStatusBar } from "../components/clinical/ErBoardStatusBar";
import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";

import { AccessDeniedError, SessionEndedError } from "../services/apiErrors";
import { getEmergencyCases } from "../services/casesApi";
import { clearAccessToken } from "../services/session";
import { createCaseHubConnection } from "../services/caseHub";
import styles from "./ErBoardPage.module.scss";

// React 19 moves <title> into the document head, so each page names its own tab.
const pageTitle = <title>ER Board · VetiFlow</title>;

export function ErBoardPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<EmergencyCaseListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

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
        setUpdatedAt(new Date());
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
      </header>

      <PatientFlowBoard
        cases={cases}
        updatedAt={updatedAt}
        selectedCaseId={selectedCaseId}
        onSelect={setSelectedCaseId}
      />
    </main>
  );
}