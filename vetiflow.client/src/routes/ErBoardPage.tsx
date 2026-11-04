import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { BoardHeading } from "../components/board/BoardHeading";
import { BoardStats, type BoardFilter } from "../components/board/BoardStats";
import { PatientFlowBoard } from "../components/board/PatientFlowBoard";
import { isAwaitingVet, isCriticalWithoutVet } from "../components/board/boardFormat";
import { DoorToDoctorDialog } from "../components/board/DoorToDoctorDialog";
import { IntakeDialog, type IntakeAssignment } from "../components/intake/IntakeDialog";
import { PatientOverviewPanel } from "../components/overview/PatientOverviewPanel";
import { RecordDrawer } from "../components/overview/RecordDrawer";
import { useMediaQuery } from "../components/auth/useMediaQuery";
import { useDemoIdentity } from "../components/board/useDemoIdentity";
import { useDemoRole, type DemoRole } from "../components/shell/demoRoleContext";
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

// Matches the 1100 px breakpoint in ErBoardPage.module.scss.
const drawerQuery = "(max-width: 1100px)";

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

// The intake's assignments that did not save (4.1c): the case exists, so say
// which to assign from the record.
const assignmentNames: Record<IntakeAssignment, string> = {
  technician: "primary technician",
  veterinarian: "attending veterinarian"
};

function unsavedAssignments(failed: IntakeAssignment[]): string {
  if (failed.length === 0) return "";
  return `. The ${failed.map((assignment) => assignmentNames[assignment]).join(" and ")} wasn't assigned; assign from the record.`;
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
  // Where the board puts focus after the record's close ✕ (3.2f).
  const [boardFocus, setBoardFocus] = useState<{ caseId: string } | null>(null);
  // Selected once the first load shows the case is still on the board.
  const arrivalCaseId = useRef(selectedOnArrival(location.state));
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDoorToDoctorOpen, setIsDoorToDoctorOpen] = useState(false);
  const showToast = useToast();
  // Shared with the top bar inside the shell; the page's own outside it.
  const shellSearch = useShellSearch();
  const [ownSearch, setOwnSearch] = useState("");
  const [search, setSearch] = shellSearch ?? [ownSearch, setOwnSearch];
  // Reloads the board now, without waiting for the hub's notice.
  const reloadCases = useRef<() => Promise<void>>(async () => {});
  // At tablet and phone widths the record is a drawer over the board (2.27a).
  const isDrawerLayout = useMediaQuery(drawerQuery);
  // The Demo role switch (2.28) and the person that view acts as.
  const [demoRole, setDemoRole] = useDemoRole();
  const demoIdentity = useDemoIdentity(demoRole);

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
  function showNewIntake(result: CaseIntakeResult, petName: string, failed: IntakeAssignment[]) {
    setSelectedCaseId(result.id);
    showToast(`${petName} added to triage queue${unsavedAssignments(failed)}`);
    void reloadCases.current();
  }

  // The stats, and Door to doctor's Show waiting patients (2.16b), filter the board (2.12b, 2.26a). An empty triage queue, or no
  // critical patient without a vet, keeps the board as it is, as in the prototype.
  function chooseFilter(chosen: BoardFilter) {
    if (chosen === "awaitingTriage" && summary?.awaitingTriage === 0) {
      showToast("No patients awaiting triage");
      return;
    }

    if (chosen === "criticalWithoutVet" && !cases.some(isCriticalWithoutVet)) {
      showToast("No critical patients without a veterinarian");
      return;
    }

    if (chosen === "awaitingVet" && !cases.some(isAwaitingVet)) {
      showToast("No patients waiting for a vet");
      return;
    }

    setFilter(chosen);
  }

  // Triage saved from the panel (4.2b): reload now rather than wait for the hub.
  function showTriaged(message: string) {
    showToast(message);
    void reloadCases.current();
  }

  // The selection, record and board filters stay, so views can be compared.
  function changeDemoRole(role: DemoRole) {
    setDemoRole(role);
    showToast(`Demo view: ${role === "technician" ? "Technician" : "Veterinarian"}`);
  }

  // Every way out of the record (3.2f ✕, and the drawer's Escape and backdrop):
  // the same unsaved-draft guard as choosing another patient.
  function closeRecord() {
    const closedCaseId = selectedCaseId;
    void drafts.requestLeave(() => {
      setSelectedCaseId(null);
      if (closedCaseId) setBoardFocus({ caseId: closedCaseId });
    });
  }

  const record = (
    <PatientOverviewPanel
      demoIdentity={demoIdentity}
      caseId={selectedCaseId}
      caseUnavailable={selectedCaseId !== null && !cases.some(item => item.id === selectedCaseId)}
      refreshedAt={updatedAt}
      onTriaged={showTriaged}
      onTaskSaved={() => void reloadCases.current()}
      onVitalsSaved={() => void reloadCases.current()}
      onClose={closeRecord}
    />
  );

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
      <BoardHeading summary={summary} onIntake={() => setIsIntakeOpen(true)} onDoorToDoctor={() => setIsDoorToDoctorOpen(true)}
        demoRole={demoRole} demoIdentity={demoIdentity.label} onDemoRoleChange={changeDemoRole} />

      <BoardStats summary={summary} criticalWithoutVet={cases.filter(isCriticalWithoutVet).length} filter={filter} onFilter={chooseFilter} />

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
          onSearchChange={setSearch}
          focusRequest={boardFocus}
          demoIdentity={demoIdentity}
        />

        {!isDrawerLayout && record}
      </div>

      {isDrawerLayout && selectedCaseId !== null && <RecordDrawer onClose={closeRecord}>{record}</RecordDrawer>}

      {summary && (
        <DoorToDoctorDialog
          isOpen={isDoorToDoctorOpen}
          summary={summary}
          onShowWaiting={() => {
            setIsDoorToDoctorOpen(false);
            chooseFilter("awaitingVet");
          }}
          onClose={() => setIsDoorToDoctorOpen(false)}
        />
      )}

      <IntakeDialog
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        onCreated={showNewIntake}
      />
    </main>
  );
}
