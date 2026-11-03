import type { BoardSummary } from "../../types/BoardSummary";
import styles from "./BoardStats.module.scss";

// What the stats strip's stats show on the board (build plan 2.12b, 2.26a).
export type BoardFilter = "all" | "awaitingTriage" | "critical" | "criticalWithoutVet";

interface BoardStatsProps {
  // Null while the summary could not be loaded; the board still shows.
  summary: BoardSummary | null;
  // Counted from the board list: critical cases with no attending veterinarian.
  criticalWithoutVet: number;
  filter: BoardFilter;
  onFilter: (filter: BoardFilter) => void;
}

// The prototype's compact stats strip (#stats, build plan 2.26a): a number and
// a label per stat, each filtering the board. Door to doctor follows in 2.16b.
export function BoardStats({ summary, criticalWithoutVet, filter, onFilter }: BoardStatsProps) {
  const stats: { key: BoardFilter; label: string; value: number | undefined; isAlert?: boolean }[] = [
    { key: "all", label: "In care", value: summary?.patientsInCare },
    { key: "awaitingTriage", label: "Awaiting triage", value: summary?.awaitingTriage },
    { key: "critical", label: "Critical", value: summary?.criticalPatients },
    { key: "criticalWithoutVet", label: "Critical without vet", value: criticalWithoutVet, isAlert: true }
  ];

  return (
    <section className={styles.stats} aria-label="Shift summary">
      {stats.map(stat => (
        <button
          key={stat.key}
          type="button"
          className={styles.stat}
          aria-pressed={filter === stat.key}
          aria-label={`${stat.label}, ${stat.value ?? "not available"}`}
          data-alert={stat.isAlert}
          onClick={() => onFilter(stat.key)}
        >
          <strong className={styles.number}>{stat.value ?? "—"}</strong>
          <span className={styles.label}>{stat.label}</span>
        </button>
      ))}
    </section>
  );
}
