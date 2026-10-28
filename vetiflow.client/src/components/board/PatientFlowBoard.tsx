import { useId, useState, type CSSProperties } from "react";
import type { AcuityLevel, EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { minutesSince } from "./boardFormat";
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

// The prototype's "Patient flow" (build plan 2.11b): one lane per acuity,
// cards in the API's order. Cases with no acuity (old data only) get their own
// lane so none are hidden. At phone width, tabs show one lane at a time.
export function PatientFlowBoard({ cases, updatedAt, selectedCaseId, onSelect }: PatientFlowBoardProps) {
  const titleId = useId();
  const now = useNow();
  const [shownLane, setShownLane] = useState<LaneKey>("critical");

  const lanes: Lane[] = acuityLanes.map((lane) => ({
    ...lane,
    cases: cases.filter((emergencyCase) => emergencyCase.acuity === lane.key)
  }));
  const untriaged = cases.filter((emergencyCase) => emergencyCase.acuity === null);
  if (untriaged.length > 0) {
    lanes.unshift({ key: "untriaged", title: "Not triaged", cases: untriaged });
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
        <h2 id={titleId} className={styles.title}>Patient flow</h2>
        <p className={styles.tiny}>
          <span className={styles.live} aria-hidden="true" />
          {updatedLabel(updatedAt, now)}
          <span className={styles.dot} aria-hidden="true">·</span>
          {casesLabel(cases.length)}
        </p>
      </header>

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

      <div className={styles.lanes} style={{ "--lane-count": lanes.length } as CSSProperties}>
        {lanes.map((lane) => (
          <AcuityLane
            key={lane.key}
            lane={lane}
            isShown={shownLane === lane.key}
            now={now}
            selectedCaseId={selectedCaseId}
            onSelect={onSelect}
          />
        ))}
      </div>

      <p className={styles.foot}>
        Showing {cases.length} of {casesLabel(cases.length)}
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
