import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { BoardHeading } from "../components/board/BoardHeading";
import { BoardStats, type BoardFilter } from "../components/board/BoardStats";
import { BoardViewSwitch } from "../components/board/BoardViewSwitch";
import { PatientFlowBoard } from "../components/board/PatientFlowBoard";
import { useNow } from "../components/board/useNow";
import { IntakeDialog } from "../components/intake/IntakeDialog";
import { PatientOverviewPanel } from "../components/overview/PatientOverviewPanel";
import { useShellSearch } from "../components/shell/shellSearchContext";
import { useToast } from "../components/shell/toastContext";
import type { BoardSummary } from "../types/BoardSummary";
import type { CaseIntakeResult } from "../types/CaseIntake";
import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";

import { AccessDeniedError, SessionEndedError } from "../services/apiErrors";
import { getBoardSummary } from "../services/boardApi";
import { getEmergencyCases } from "../services/casesApi";
import { clearAccessToken } from "../services/session";
import { createCaseHubConnection } from "../services/caseHub";
import styles from "./ErBoardPage.module.scss";
import { useClinicalDraftNavigation } from "../components/forms/clinicalDraftContext";

// React 19 moves <title> into the document head, so each page names its own tab.
const pageTitle = <title>ER Board · VetiFlow</title>;

// The stat cards' numbers, or null when only they failed: the board still
// shows. A refused session still ends the board, as for the cases.
async function loadSummary(): Promise<BoardSummary | null> {
  try {
    return await getBoardSummary();
  } catch (summaryError) {
    if (summaryError instanceof SessionEndedError || summaryError instanceof AccessDeniedError) {
      throw summaryError;
    }

    return null;
  }
}

// Router state that selects a case on arrival, as the patient profile's
// "ER board" link sends it (4.21c).
export interface ErBoardRouteState {
  selectedCaseId?: string;
}

function selectedOnArrival(state: unknown): string | null {
  const caseId = (state as ErBoardRouteState | null)?.selectedCaseId;
  return typeof caseId === "string" ? caseId : null;
}

export function ErBoardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const drafts = useClinicalDraftNavigation();
  const [cases, setCases] = useState<EmergencyCaseListItem[]>([]);
  const [summary, setSummary] = useState<BoardSummary | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  // Selected once the first load shows the case is still on the board.
  const arrivalCaseId = useRef(selectedOnArrival(location.state));
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const showToast = useToast();
  const now = useNow();
  const search = useShellSearch();
  // Reloads the board now, without waiting for the hub's notice.
  const reloadCases = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let isActive = true;

    const connection = createCaseHubConnection();

    async function loadCases() {
      try {
        const [emergencyCases, boardSummary] = await Promise.all([getEmergencyCases(), loadSummary()]);

        if (!isActive) {
          return;
        }

        setCases(emergencyCases);
        setSummary(boardSummary);
        const arrival = arrivalCaseId.current;
        arrivalCaseId.current = null;
        // A case that left the board (discharged) is no longer selected.
        setSelectedCaseId((selected) => {
          const wanted = selected ?? arrival;
          return drafts.hasDraft() || emergencyCases.some((emergencyCase) => emergencyCase.id === wanted) ? wanted : null;
        });
        setUpdatedAt(new Date());
        setError(null);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        // The token expired or was refused while the board was open.
        if (loadError instanceof SessionEndedError) {
          drafts.forceExit();
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else if (loadError instanceof AccessDeniedError) {
          drafts.forceExit();
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
  }, [navigate, drafts]);

  // The new case appears in its lane, selected (prototype intake).
  function showNewIntake(result: CaseIntakeResult, petName: string) {
    setSelectedCaseId(result.id);
    showToast(`${petName} added to triage queue`);
    void reloadCases.current();
  }

  // The stat cards filter the board (2.12b). An empty triage queue keeps the
  // board as it is, as in the prototype.
  function chooseFilter(chosen: BoardFilter) {
    if (chosen === "awaitingTriage" && summary?.awaitingTriage === 0) {
      showToast("No patients awaiting triage");
      return;
    }

    setFilter(chosen);
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

  if (error && cases.length === 0 && !drafts.hasDraft()) {
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
      {error && <p role="alert">{error}</p>}
      <BoardHeading summary={summary} onIntake={() => setIsIntakeOpen(true)} />

      <BoardViewSwitch />

      <BoardStats summary={summary} filter={filter} now={now} onFilter={chooseFilter} />

      <div className={styles.layout}>
        <PatientFlowBoard
          cases={cases}
          updatedAt={updatedAt}
          selectedCaseId={selectedCaseId}
          onSelect={id => {
            if (id !== selectedCaseId) void drafts.requestLeave(() => setSelectedCaseId(id));
          }}
          filter={filter}
          search={search}
          onFilter={chooseFilter}
        />

        <PatientOverviewPanel
          caseId={selectedCaseId}
          caseUnavailable={selectedCaseId !== null && !cases.some(item => item.id === selectedCaseId)}
          refreshedAt={updatedAt}
          onTriaged={showTriaged}
          onTaskSaved={() => void reloadCases.current()}
          onVitalsSaved={() => void reloadCases.current()}
        />
      </div>

      <IntakeDialog
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        onCreated={showNewIntake}
      />
    </main>
  );
}
