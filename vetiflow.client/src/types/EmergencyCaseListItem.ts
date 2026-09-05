export type CaseStage =
  | "incoming"
  | "triage"
  | "treatment"
  | "diagnostics"
  | "recheck"
  | "discharge";

export type CaseStatus =
  | "unassigned"
  | "assigned"
  | "waiting"
  | "inProgress"
  | "blocked"
  | "readyForNextStep"
  | "completed";

export type AcuityLevel =
  | "critical"
  | "urgent"
  | "stable"
  | "low";

export interface EmergencyCaseListItem {
  id: string;
  patientId: string;
  patientName: string;
  species: string;
  breed: string | null;
  weightKg: number | null;
  presentingComplaint: string;
  stage: CaseStage;
  status: CaseStatus;
  acuity: AcuityLevel | null;
  arrivalTime: string;
  nextAction: string | null;
}