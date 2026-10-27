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
  | "high"
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
  assignedDoctor: CaseReference | null;
  assignedTechnician: CaseReference | null;
  room: CaseReference | null;
  // Open blockers only, oldest first.
  blockers: CaseBlocker[];
  lastUpdated: string;
}

// A staff member or room on a case.
export interface CaseReference {
  id: string;
  name: string;
}

export interface CaseBlocker {
  id: string;
  description: string;
}