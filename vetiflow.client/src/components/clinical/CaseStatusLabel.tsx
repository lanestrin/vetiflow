import type { CaseStatus } from "../../types/EmergencyCaseListItem";
import styles from "./CaseStatusLabel.module.scss";

interface CaseStatusLabelProps {
  status: CaseStatus;
}

const statusLabels: Record<CaseStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  waiting: "Waiting",
  inProgress: "In Progress",
  blocked: "Blocked",
  readyForNextStep: "Ready for Next Step",
  completed: "Completed"
};

export function CaseStatusLabel({
  status
}: CaseStatusLabelProps) {
  return (
    <span className={styles.status}>
      {statusLabels[status]}
    </span>
  );
}