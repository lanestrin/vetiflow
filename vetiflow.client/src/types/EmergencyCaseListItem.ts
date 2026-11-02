
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
  | "stable";

// What the card's wait chip shows; "minutes" counts from arrival on screen.
export type WaitChip = "stat" | "ready" | "recheck" | "new" | "minutes";

export type RoomType =
  | "exam"
  | "treatment"
  | "icu"
  | "oxygen"
  | "isolation"
  | "surgery"
  | "imaging";

export interface EmergencyCaseListItem {
  id: string;
  // "ER-2481".
  caseNumber: string;
  patientId: string;
  patientName: string;
  species: string;
  breed: string | null;
  // "2018-04-02"; the card shows the age from it.
  patientDateOfBirth: string | null;
  // Never contact details.
  ownerName: string | null;
  weightKg: number | null;
  presentingComplaint: string;
  stage: CaseStage;
  stageEnteredAt: string;
  status: CaseStatus;
  acuity: AcuityLevel | null;
  arrivalTime: string;
  nextAction: string | null;
  assignedDoctor: CaseReference | null;
  assignedTechnician: CaseReference | null;
  room: CaseRoom | null;
  // The doctor, or the technician when no doctor is assigned.
  clinician: CaseClinician | null;
  waitChip: WaitChip;
  // Open blockers only, oldest first.
  blockers: CaseBlocker[];
  lastUpdated: string;
}

// A staff member on a case.
export interface CaseReference {
  id: string;
  name: string;
}

export interface CaseRoom {
  id: string;
  name: string;
  type: RoomType;
}

// "JR Reed" on a card.
export interface CaseClinician {
  id: string;
  shortName: string;
  initials: string;
}

export interface CaseBlocker {
  id: string;
  description: string;
}
