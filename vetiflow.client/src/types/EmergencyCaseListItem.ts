
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
  // The door-to-doctor milestones (2.16a), worked out on the server.
  vetAssessment: VetAssessment | null;
  nextActionOwner: NextActionOwner | null;
  vetMilestone: VetMilestone;
}

// The initial veterinarian assessment: when it happened, when it was entered
// and by whom (2.16a).
export interface VetAssessment {
  occurredAt: string;
  recordedAt: string;
  recordedBy: CaseReference | null;
}

// The designated Next Care Action's owner: a technician handoff, or a vet
// handling it personally ("Vet owned").
export interface NextActionOwner {
  id: string;
  name: string;
  role: "technician" | "veterinarian";
}

// The two milestones combined: no assessment or owner; "Task assigned · Vet
// assessment pending"; "Awaiting vet next action"; both recorded.
export type VetMilestone = "awaitingVet" | "assessmentPending" | "awaitingNextAction" | "nextActionAssigned";

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
