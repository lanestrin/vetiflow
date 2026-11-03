import { useId, useState } from "react";
import { Link } from "react-router-dom";
import type { AcuityLevel, EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import type { BoardFilter } from "./BoardStats";
import { BoardFilterMenu } from "./BoardFilterMenu";
import {
  isCriticalWithoutVet,
  matchesMenuFilters,
  matchesSearch,
  minutesSince,
  noMenuFilters,
  sortByLongestInStage,
  type BoardMenuFilters
} from "./boardFormat";
import { PatientRow } from "./PatientRow";
import { useNow } from "./useNow";
import styles from "./PatientFlowBoard.module.scss";

interface PatientFlowBoardProps {
  cases: EmergencyCaseListItem[];
  // When the board last loaded, for "Updated just now".
  updatedAt: Date;
  selectedCaseId: string | null;
  onSelect: (caseId: string) => void;
  // From the stat cards (2.12b); every case when not given.
  filter?: BoardFilter;
  // The top bar's search (2.14a), applied after the filter.
  search?: string;
  // The Incoming toggle asks for a filter (2.14b); the page decides.
  onFilter?: (filter: BoardFilter) => void;
}

// The API's acuity order: cases not triaged (old data only), then Critical,
// Urgent, Stable.
const acuityOrder: (AcuityLevel | null)[] = [null, "critical", "urgent", "stable"];

function updatedLabel(updatedAt: Date, now: Date): string {
  const minutes = minutesSince(updatedAt.toISOString(), now);
  return minutes < 1 ? "Updated just now" : `Updated ${minutes} min ago`;
}

function casesLabel(count: number): string {
  return count === 1 ? "1 active case" : `${count} active cases`;
}

const filterNotes: Record<BoardFilter, string> = {
  all: "",
  awaitingTriage: " · awaiting triage · initial priority is provisional",
  critical: " · critical only",
  criticalWithoutVet: " · critical without a veterinarian"
};

// The footer count (2.26a): matching active patients out of all active
// patients, whatever the filter, menu or search.
function footLabel(filter: BoardFilter, shownCount: number, totalCount: number, searchText: string): string {
  const patients = totalCount === 1 ? "1 active patient" : `${totalCount} active patients`;
  const matching = searchText === "" ? "" : ` matching “${searchText}”`;
  return `Showing ${shownCount} of ${patients}${matching}${filterNotes[filter]}`;
}

function matchesStatFilter(emergencyCase: EmergencyCaseListItem, filter: BoardFilter): boolean {
  switch (filter) {
    case "awaitingTriage": return emergencyCase.stage === "incoming";
    case "critical": return emergencyCase.acuity === "critical";
    case "criticalWithoutVet": return isCriticalWithoutVet(emergencyCase);
    case "all": return true;
  }
}

// The board table (build plan 2.25, the prototype's `.board`): one row per
// case in the API's order, or longest in stage first within each acuity
// while Priority is pressed (2.14d). The stat cards' filter keeps only
// incoming cases or only critical ones. At phone width the rows become cards.
export function PatientFlowBoard({
  cases,
  updatedAt,
  selectedCaseId,
  onSelect,
  filter = "all",
  search = "",
  onFilter
}: PatientFlowBoardProps) {
  const titleId = useId();
  const now = useNow();
  // The Filter menu's choices (2.14c), kept while the page is open.
  const [menuFilters, setMenuFilters] = useState<BoardMenuFilters>(noMenuFilters);
  // The Priority button (2.14d): the API's priority order unless pressed.
  const [isLongestInStageFirst, setIsLongestInStageFirst] = useState(false);

  const filteredCases = cases.filter((emergencyCase) => matchesStatFilter(emergencyCase, filter));
  const matchingCases = filteredCases.filter((emergencyCase) =>
    matchesMenuFilters(emergencyCase, menuFilters) && matchesSearch(emergencyCase, search));
  const shownCases = isLongestInStageFirst
    ? sortByLongestInStage(matchingCases).sort((first, second) =>
      acuityOrder.indexOf(first.acuity) - acuityOrder.indexOf(second.acuity))
    : matchingCases;
  const searchText = search.trim();
  const incomingCount = cases.filter((emergencyCase) => emergencyCase.stage === "incoming").length;
  const isIncomingShown = filter === "awaitingTriage";
  const emptyMessage = cases.length === 0 ? "No patients on the board" : "No patients match";

  return (
    <section className={styles.board} aria-labelledby={titleId}>
      <header className={styles.top}>
        <div>
          <h2 id={titleId} className={styles.title}>Patient board</h2>
          <p className={styles.tiny}>
            <span className={styles.live} aria-hidden="true" />
            {updatedLabel(updatedAt, now)}
            <span className={styles.dot} aria-hidden="true">·</span>
            {casesLabel(cases.length)}
          </p>
        </div>
        <div className={styles.tools}>
          {/* The prototype's #triageToggle: the Awaiting triage filter, on and off. */}
          <button
            type="button"
            className={styles.toolButton}
            aria-pressed={isIncomingShown}
            aria-label={`Incoming, ${incomingCount} awaiting triage`}
            onClick={() => onFilter?.(isIncomingShown ? "all" : "awaitingTriage")}
          >
            <span aria-hidden="true">⇣ </span>
            <span className={styles.toolLabel}>Incoming</span> <b>{incomingCount}</b>
          </button>
          <BoardFilterMenu cases={cases} filters={menuFilters} onChange={setMenuFilters} />
          {/* The prototype's #sort. */}
          <button
            type="button"
            className={styles.toolButton}
            aria-pressed={isLongestInStageFirst}
            aria-label="Priority, longest in stage first"
            onClick={() => setIsLongestInStageFirst(!isLongestInStageFirst)}
          >
            <span aria-hidden="true">↕ </span>
            <span className={styles.toolLabel}>Priority</span>
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table} aria-labelledby={titleId}>
          <thead className={styles.head}>
            <tr>
              <th scope="col" className={styles.patientColumn}>Patient</th>
              <th scope="col" className={styles.acuityColumn}>Acuity</th>
              <th scope="col" className={styles.stageColumn}>Care stage</th>
              <th scope="col" className={styles.teamColumn}>Care team</th>
              <th scope="col" className={styles.chevronColumn}><span className={styles.hidden}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {shownCases.length === 0 ? (
              <tr>
                <td className={styles.empty} colSpan={5}>{emptyMessage}</td>
              </tr>
            ) : (
              shownCases.map((emergencyCase) => (
                <PatientRow
                  key={emergencyCase.id}
                  emergencyCase={emergencyCase}
                  now={now}
                  isSelected={emergencyCase.id === selectedCaseId}
                  onSelect={onSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className={styles.foot}>
        {footLabel(filter, shownCases.length, cases.length, searchText)}
        {searchText !== "" && (
          // Patients finds a pet who isn't on the board (4.6a).
          <>
            {" · "}
            <Link className={styles.footLink} to={`/records?search=${encodeURIComponent(searchText)}`}>
              Search all patients
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
