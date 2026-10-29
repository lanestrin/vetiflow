import type { ReactNode } from "react";
import type { BoardSummary } from "../../types/BoardSummary";
import { minutesSince } from "./boardFormat";
import styles from "./BoardStats.module.scss";

// What the clickable stat cards show on the board (build plan 2.12b).
export type BoardFilter = "all" | "awaitingTriage" | "critical";

interface BoardStatsProps {
  // Null while the summary could not be loaded; the board still shows.
  summary: BoardSummary | null;
  filter: BoardFilter;
  now: Date;
  onFilter: (filter: BoardFilter) => void;
}

const unavailable = "Not available";

function shiftStartLabel(startedAt: string): string {
  return new Date(startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function careFoot(summary: BoardSummary): ReactNode {
  return (
    <>
      <strong>+{summary.arrivedThisShift}</strong> since {shiftStartLabel(summary.shift.startedAt)}
    </>
  );
}

function triageFoot(summary: BoardSummary, now: Date): ReactNode {
  if (summary.oldestAwaitingTriageArrivedAt === null) {
    return "No patients awaiting triage";
  }

  return (
    <>
      Click to view incoming cases · oldest wait{" "}
      <strong className={styles.wait}>{minutesSince(summary.oldestAwaitingTriageArrivedAt, now)} min</strong>
    </>
  );
}

function criticalFoot(summary: BoardSummary): ReactNode {
  if (summary.criticalPatients === 0) {
    return "No critical patients";
  }

  if (summary.criticalWithoutCareTeam > 0) {
    return (
      <>
        <strong className={styles.alert}>{summary.criticalWithoutCareTeam}</strong> without a care team
      </>
    );
  }

  if (summary.criticalPatients === 1) {
    return "Assigned to a care team";
  }

  return summary.criticalPatients === 2 ? "Both assigned to a care team" : "All assigned to a care team";
}

// The prototype's four stat cards (.stats). Three filter the board; door to
// doctor shows "—" until 2.16b.
export function BoardStats({ summary, filter, now, onFilter }: BoardStatsProps) {
  return (
    <section className={styles.stats} aria-label="Board summary">
      <StatCard
        label="Patients in care"
        icon={<span aria-hidden="true">↗</span>}
        value={summary?.patientsInCare}
        foot={summary ? careFoot(summary) : unavailable}
        isPressed={filter === "all"}
        onPress={() => onFilter("all")}
      />
      <StatCard
        label="Awaiting triage"
        icon={<span className={styles.dot} aria-hidden="true" />}
        value={summary?.awaitingTriage}
        foot={summary ? triageFoot(summary, now) : unavailable}
        isPressed={filter === "awaitingTriage"}
        onPress={() => onFilter("awaitingTriage")}
      />
      <StatCard
        label="Critical patients"
        icon={<span className={styles.heart} aria-hidden="true">♥</span>}
        value={summary?.criticalPatients}
        foot={summary ? criticalFoot(summary) : unavailable}
        isPressed={filter === "critical"}
        onPress={() => onFilter("critical")}
      />
      <div className={styles.stat} role="group" aria-label="Avg. door to doctor">
        <div className={styles.head}>
          <span>Avg. door to doctor</span>
          <span aria-hidden="true">◷</span>
        </div>
        <div className={styles.number}>—</div>
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  icon: ReactNode;
  value: number | undefined;
  foot: ReactNode;
  isPressed: boolean;
  onPress: () => void;
}

function StatCard({ label, icon, value, foot, isPressed, onPress }: StatCardProps) {
  return (
    <button
      type="button"
      className={`${styles.stat} ${styles.clickable}`}
      aria-pressed={isPressed}
      onClick={onPress}
    >
      <span className={styles.head}>
        <span>{label}</span>
        {isPressed && <span className={styles.activeState}>Active</span>}
        {icon}
      </span>
      <span className={styles.number}>{value ?? "—"}</span>
      <span className={styles.foot}>{foot}</span>
    </button>
  );
}
