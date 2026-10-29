import { useId, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { AcuityLevel, EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import type { BoardFilter } from "./BoardStats";
import { matchesSearch, minutesSince } from "./boardFormat";
import { PatientCard } from "./PatientCard";
import { useNow } from "./useNow";
import styles from "./PatientFlowBoard.module.scss";

type LaneKey = AcuityLevel | "untriaged";

interface Lane {
  key: LaneKey;
  title: string;
  cases: EmergencyCaseListItem[];
}

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

const acuityLanes: { key: AcuityLevel; title: string }[] = [
  { key: "critical", title: "Critical" },
  { key: "urgent", title: "Urgent" },
  { key: "stable", title: "Stable" }
];

function updatedLabel(updatedAt: Date, now: Date): string {
  const minutes = minutesSince(updatedAt.toISOString(), now);
  return minutes < 1 ? "Updated just now" : `Updated ${minutes} min ago`;
}

function casesLabel(count: number): string {
  return count === 1 ? "1 active case" : `${count} active cases`;
}

// The prototype's #flowFoot for each stat card filter.
function footLabel(filter: BoardFilter, shownCount: number, totalCount: number): string {
  if (filter === "awaitingTriage") {
    return `Showing ${shownCount} awaiting triage cases · initial priority is provisional`;
  }

  if (filter === "critical") {
    return `Showing ${shownCount} critical patients · other acuity lanes hidden`;
  }

  return `Showing ${shownCount} of ${casesLabel(totalCount)}`;
}

// The prototype's "Patient flow" (build plan 2.11b): one lane per acuity,
// cards in the API's order. Cases with no acuity (old data only) get their own
// lane so none are hidden. At phone width, tabs show one lane at a time.
// The stat cards' filter keeps only incoming cards (lanes stacked, as in the
// prototype) or only the Critical lane.
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
  const [shownLane, setShownLane] = useState<LaneKey>("critical");

  const filteredCases = filter === "awaitingTriage"
    ? cases.filter((emergencyCase) => emergencyCase.stage === "incoming")
    : cases;
  const shownCases = filteredCases.filter((emergencyCase) => matchesSearch(emergencyCase, search));
  const searchText = search.trim();
  const incomingCount = cases.filter((emergencyCase) => emergencyCase.stage === "incoming").length;
  const isIncomingShown = filter === "awaitingTriage";
  const shownAcuityLanes = filter === "critical"
    ? acuityLanes.filter((lane) => lane.key === "critical")
    : acuityLanes;

  const lanes: Lane[] = shownAcuityLanes.map((lane) => ({
    ...lane,
    cases: shownCases.filter((emergencyCase) => emergencyCase.acuity === lane.key)
  }));
  const untriaged = shownCases.filter((emergencyCase) => emergencyCase.acuity === null);
  if (filter !== "critical" && untriaged.length > 0) {
    lanes.unshift({ key: "untriaged", title: "Not triaged", cases: untriaged });
  }
  const shownCount = lanes.reduce((count, lane) => count + lane.cases.length, 0);
  // Every lane at phone width too, so no incoming card sits behind a tab.
  const isStacked = filter === "awaitingTriage";

  // The Critical filter shows its lane at phone width too.
  const [followedFilter, setFollowedFilter] = useState(filter);
  if (filter !== followedFilter) {
    setFollowedFilter(filter);
    if (filter === "critical") {
      setShownLane("critical");
    }
  }

  // At phone width, show the lane of a newly selected case (for example a new
  // intake), as the prototype does.
  const selectedLane = lanes.find((lane) => lane.cases.some((emergencyCase) => emergencyCase.id === selectedCaseId))?.key;
  const [followedLane, setFollowedLane] = useState(selectedLane);
  if (selectedLane !== followedLane) {
    setFollowedLane(selectedLane);
    if (selectedLane) {
      setShownLane(selectedLane);
    }
  }

  return (
    <section className={styles.board} aria-labelledby={titleId}>
      <header className={styles.top}>
        <div>
          <h2 id={titleId} className={styles.title}>Patient flow</h2>
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
        </div>
      </header>

      {!isStacked && (
        <div className={styles.tabs} aria-label="Show lane" role="group">
          {lanes.map((lane) => (
            <button
              key={lane.key}
              type="button"
              className={styles.tab}
              aria-pressed={shownLane === lane.key}
              onClick={() => setShownLane(lane.key)}
            >
              {lane.title}
            </button>
          ))}
        </div>
      )}

      <div className={styles.lanes} style={{ "--lane-count": lanes.length } as CSSProperties}>
        {lanes.map((lane) => (
          <AcuityLane
            key={lane.key}
            lane={lane}
            isShown={isStacked || shownLane === lane.key}
            now={now}
            selectedCaseId={selectedCaseId}
            onSelect={onSelect}
          />
        ))}
      </div>

      <p className={styles.foot}>
        {searchText === "" ? (
          footLabel(filter, shownCount, cases.length)
        ) : (
          // Patients finds a pet who isn't on the board (4.6a).
          <>
            Showing {shownCount} matching “{searchText}” ·{" "}
            <Link className={styles.footLink} to={`/records?search=${encodeURIComponent(searchText)}`}>
              Search all patients
            </Link>
          </>
        )}
      </p>
    </section>
  );
}

interface AcuityLaneProps {
  lane: Lane;
  isShown: boolean;
  now: Date;
  selectedCaseId: string | null;
  onSelect: (caseId: string) => void;
}

function AcuityLane({ lane, isShown, now, selectedCaseId, onSelect }: AcuityLaneProps) {
  const titleId = useId();

  return (
    <section
      className={styles.lane}
      data-lane={lane.key}
      data-shown={isShown}
      aria-labelledby={titleId}
    >
      <div className={styles.laneHead}>
        <h3 id={titleId} className={styles.laneTitle}>
          <span aria-hidden="true">● </span>{lane.title}
        </h3>
        <span className={styles.count}>{lane.cases.length}</span>
      </div>
      {lane.cases.length === 0 ? (
        <p className={styles.empty}>No patients</p>
      ) : (
        lane.cases.map((emergencyCase) => (
          <PatientCard
            key={emergencyCase.id}
            emergencyCase={emergencyCase}
            now={now}
            isSelected={emergencyCase.id === selectedCaseId}
            onSelect={onSelect}
          />
        ))
      )}
    </section>
  );
}
