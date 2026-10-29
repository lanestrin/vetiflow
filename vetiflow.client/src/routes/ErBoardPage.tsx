import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { PatientFlowBoard } from "../components/board/PatientFlowBoard";
import { ErBoardStatusBar } from "../components/clinical/ErBoardStatusBar";
import { IntakeDialog } from "../components/intake/IntakeDialog";
import { PatientOverviewPanel } from "../components/overview/PatientOverviewPanel";
import { useToast } from "../components/shell/toastContext";
import type { CaseIntakeResult } from "../types/CaseIntake";
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
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const showToast = useToast();
  // Reloads the board now, without waiting for the hub's notice.
  const reloadCases = useRef<() => Promise<void>>(async () => {});

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
        // A case that left the board (discharged) is no longer selected.
        setSelectedCaseId((selected) =>
          emergencyCases.some((emergencyCase) => emergencyCase.id === selected) ? selected : null);
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

    reloadCases.current = loadCases;
    void loadCases();
    void startLiveUpdates();

    return () => {
      isActive = false;
      connection.off("caseUpdated");
      void connection.stop();
    };
  }, [navigate]);

  // The new case appears in its lane, selected (prototype intake).
  function showNewIntake(result: CaseIntakeResult, petName: string) {
    setSelectedCaseId(result.id);
    showToast(`${petName} added to triage queue`);
    void reloadCases.current();
  }

  // Triage saved from the panel (4.2b): reload now rather than wait for the hub.
  function showTriaged(message: string) {
    showToast(message);
    void reloadCases.current();
  }

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

        <button type="button" className={styles.intakeButton} onClick={() => setIsIntakeOpen(true)}>
          <span aria-hidden="true">＋ </span>New intake
        </button>
      </header>

      <div className={styles.layout}>
        <PatientFlowBoard
          cases={cases}
          updatedAt={updatedAt}
          selectedCaseId={selectedCaseId}
          onSelect={setSelectedCaseId}
        />

        <PatientOverviewPanel caseId={selectedCaseId} refreshedAt={updatedAt} onTriaged={showTriaged} />
      </div>

      <IntakeDialog
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        onCreated={showNewIntake}
      />
    </main>
  );
}