import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AcuityLevel, EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import type { DemoIdentity } from "./useDemoIdentity";
import type { BoardFilter } from "./BoardStats";
import { BoardFilterMenu } from "./BoardFilterMenu";
import {
  isAwaitingVet,
  isCriticalWithoutVet,
  matchesMenuFilters,
  matchesSearch,
  matchesUnassigned,
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
  // The board's own search box changes the shared search (2.26b); without
  // it the box is not shown.
  onSearchChange?: (search: string) => void;
  // After the record closes, focus that patient's name without scrolling, or
  // the board's heading when the patient is no longer listed (3.2f).
  focusRequest?: { caseId: string } | null;
  // Whose patients My patients shows (2.28); unavailable when not given.
  demoIdentity?: DemoIdentity;
}

// The API's acuity order: cases not triaged (old data only), then Critical,
// Urgent, Stable.
const acuityOrder: (AcuityLevel | null)[] = [null, "critical", "urgent", "stable"];

function updatedLabel(updatedAt: Date, now: Date): string {
  const minutes = minutesSince(updatedAt.toISOString(), now);
  return minutes < 1 ? "Updated just now" : `Updated ${minutes} min ago`;
}

const sortExplanation = "Longest time in current stage first, within each acuity. Acuity order stays Critical, Urgent, Stable.";
const noIdentityReason = "Available with the demo role switch on the ER board (2.28).";

// The demo identity's patients (2.28): attending veterinarian in the
// Veterinarian view, primary technician in the Technician view.
function isMine(emergencyCase: EmergencyCaseListItem, identity: DemoIdentity): boolean {
  const assigned = identity.role === "technician" ? emergencyCase.assignedTechnician : emergencyCase.assignedDoctor;
  return identity.staffId !== null && assigned?.id === identity.staffId;
}

interface ScopeSwitchProps {
  count: number;
  isMineOnly: boolean;
  // Why My patients cannot be chosen yet, or null when it can.
  unavailableReason: string | null;
  onChange: (isMineOnly: boolean) => void;
}

// The prototype's .switch: All patients, or the demo identity's patients.
function ScopeSwitch({ count, isMineOnly, unavailableReason, onChange }: ScopeSwitchProps) {
  const reasonId = useId();
  return (
    <div className={styles.scope} role="group" aria-label="Patient scope">
      <button type="button" className={styles.scopeButton} aria-pressed={!isMineOnly} onClick={() => onChange(false)}>
        All patients <span className={styles.scopeCount}>{count}</span>
      </button>
      <button type="button" className={styles.scopeButton} aria-pressed={isMineOnly}
        aria-disabled={unavailableReason !== null ? "true" : undefined}
        title={unavailableReason ?? undefined} aria-describedby={unavailableReason !== null ? reasonId : undefined}
        onClick={() => { if (unavailableReason === null) onChange(true); }}>
        My patients
      </button>
      {unavailableReason !== null && <span id={reasonId} hidden>{unavailableReason}</span>}
    </div>
  );
}

function casesLabel(count: number): string {
  return count === 1 ? "1 active case" : `${count} active cases`;
}

const filterNotes: Record<BoardFilter, string> = {
  all: "",
  awaitingTriage: " · awaiting triage · initial priority is provisional",
  critical: " · critical only",
  criticalWithoutVet: " · critical without a veterinarian",
  awaitingVet: " · waiting for a vet assessment"
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
    case "awaitingVet": return isAwaitingVet(emergencyCase);
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
  onSearchChange,
  focusRequest = null,
  demoIdentity
}: PatientFlowBoardProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameButtons = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!focusRequest) return;
    (nameButtons.current.get(focusRequest.caseId) ?? headingRef.current)?.focus({ preventScroll: true });
  }, [focusRequest]);
  const now = useNow();
  // The Filter menu's choices (2.14c), kept while the page is open.
  const [menuFilters, setMenuFilters] = useState<BoardMenuFilters>(noMenuFilters);
  // Time in stage ↓ (2.14d, relabelled in 2.26b): the API's priority order
  // unless pressed.
  const [isLongestInStageFirst, setIsLongestInStageFirst] = useState(false);
  // Unassigned (2.26b): cases missing either assignment.
  const [isUnassignedOnly, setIsUnassignedOnly] = useState(false);
  // My patients (2.28), kept across a demo role change; All patients while
  // the demo identity is unknown.
  const [isMineChosen, setIsMineChosen] = useState(false);
  const scopeUnavailable = demoIdentity ? demoIdentity.unavailableReason : noIdentityReason;
  const mineOf = isMineChosen && demoIdentity && scopeUnavailable === null ? demoIdentity : null;
  const isMineOnly = mineOf !== null;

  const filteredCases = cases.filter((emergencyCase) => matchesStatFilter(emergencyCase, filter)
    && (mineOf === null || isMine(emergencyCase, mineOf)));
  const matchingCases = filteredCases.filter((emergencyCase) =>
    matchesMenuFilters(emergencyCase, menuFilters) && matchesSearch(emergencyCase, search)
    && (!isUnassignedOnly || matchesUnassigned(emergencyCase)));
  const shownCases = isLongestInStageFirst
    ? sortByLongestInStage(matchingCases).sort((first, second) =>
      acuityOrder.indexOf(first.acuity) - acuityOrder.indexOf(second.acuity))
    : matchingCases;
  const searchText = search.trim();
  const emptyMessage = cases.length === 0 ? "No patients on the board" : "No patients match";

  return (
    <section className={styles.board} aria-labelledby={titleId}>
      <header className={styles.top}>
        <div>
          <h2 ref={headingRef} id={titleId} className={styles.title} tabIndex={-1}>Patient board</h2>
          <p className={styles.tiny}>
            <span className={styles.live} aria-hidden="true" />
            {updatedLabel(updatedAt, now)}
            <span className={styles.dot} aria-hidden="true">·</span>
            {casesLabel(cases.length)}
          </p>
        </div>
        <ScopeSwitch count={cases.length} isMineOnly={isMineOnly} unavailableReason={scopeUnavailable} onChange={setIsMineChosen} />
      </header>

      {/* The prototype's .toolbar. */}
      <div className={styles.toolbar}>
        {onSearchChange && (
          <div className={styles.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search"
              className={styles.searchInput}
              aria-label="Search the board"
              placeholder="Search patients..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        )}
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={isUnassignedOnly}
          onClick={() => setIsUnassignedOnly(!isUnassignedOnly)}
        >
          Unassigned
        </button>
        <BoardFilterMenu cases={cases} filters={menuFilters} onChange={setMenuFilters} />
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={isLongestInStageFirst}
          aria-label="Time in stage"
          aria-describedby={`${titleId}-sort`}
          title={sortExplanation}
          onClick={() => setIsLongestInStageFirst(!isLongestInStageFirst)}
        >
          Time in stage <span aria-hidden="true">↓</span>
        </button>
        <span id={`${titleId}-sort`} hidden>{sortExplanation}</span>
      </div>

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
                  nameButtonRef={element => {
                    if (element) nameButtons.current.set(emergencyCase.id, element);
                    else nameButtons.current.delete(emergencyCase.id);
                  }}
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
