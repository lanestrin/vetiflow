import type { CaseStage, CaseStatus } from "./EmergencyCaseListItem";

// Stage, status and next action together, as PATCH /api/cases/{id}/status
// takes them (build plan 4.9a).
export interface CaseStatusRequest {
  stage: CaseStage;
  status: CaseStatus;
  nextAction: string | null;
}
