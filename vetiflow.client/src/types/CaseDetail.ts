import type {
  AcuityLevel,
  CaseReference,
  CaseRoom,
  CaseStage,
  CaseStatus
} from "./EmergencyCaseListItem";


export type TreatmentAuthorization = "notDiscussed" | "pending" | "authorized" | "declined";

export type OwnerUpdateStatus = "notYetUpdated" | "updated" | "awaitingOwnerReply" | "consentNeeded";

export type CaseEventType =
  | "arrived"
  | "triaged"
  | "assigned"
  | "stageChanged"
  | "statusChanged"
  | "roomChanged"
  | "noteAdded"
  | "diagnosticOrdered"
  | "diagnosticCompleted"
  | "treatmentStarted"
  | "treatmentCompleted"
  | "discharged";

// Reassessment and clientUpdate are due items with a due time (4.4a).
export type CaseTaskType = "task" | "blocker" | "reassessment" | "clientUpdate";

export type CaseTaskStatus = "open" | "done" | "cancelled";

export type PatientSex = "maleIntact" | "maleNeutered" | "femaleIntact" | "femaleSpayed";

// One case as GET /api/cases/{id} returns it (build plan 3.1, 3.2a). Team
// members only: it carries the owner's contact details and clinical notes.
export interface CaseDetail {
  id: string;
  // "ER-2481".
  caseNumber: string;
  patient: CasePatient;
  owner: CaseOwner | null;
  presentingComplaint: string;
  weightKg: number | null;
  stage: CaseStage;
  stageEnteredAt: string;
  status: CaseStatus;
  acuity: AcuityLevel | null;
  arrivalTime: string;
  lastUpdated: string;
  dischargedAt: string | null;
  nextAction: string | null;
  assignedDoctor: CaseReference | null;
  assignedTechnician: CaseReference | null;
  room: CaseRoom | null;
  allergiesAtIntake: string | null;
  medicationsAtIntake: string | null;
  treatmentAuthorization: TreatmentAuthorization;
  referringClinic: string | null;
  ownerUpdateStatus: OwnerUpdateStatus;
  lastOwnerUpdateAt: string | null;
  // Newest first.
  triageAssessments: TriageAssessment[];
  // Newest first.
  vitals: VitalsRecord[];
  latestPainScore: PainScore | null;
  // Open first, then oldest first.
  tasks: CaseTask[];
  // The earliest due open reassessment and client update (4.4a).
  nextReassessment: CaseDueItem | null;
  nextClientUpdate: CaseDueItem | null;
  // Oldest first.
  timeline: CaseEvent[];
}

export interface CasePatient {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: PatientSex | null;
  // "2018-04-02".
  dateOfBirth: string | null;
  dateOfBirthIsEstimated: boolean;
  allergies: string | null;
  currentMedications: string | null;
}

export interface CaseOwner {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

export interface TriageAssessment {
  id: string;
  acuity: AcuityLevel;
  rawIntakeNotes: string | null;
  // When the assessment happened, if known (4.11a); assessedAt is entry time.
  occurredAt: string | null;
  assessedAt: string;
  assessedBy: CaseReference | null;
}

export type VitalName = "heartRate" | "respiratoryRate" | "temperatureF" | "spO2";

// Any reading may be missing; temperature is stored in °F.
export interface VitalsRecord {
  id: string;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperatureF: number | null;
  spO2: number | null;
  outOfRange: VitalName[];
  mucousMembraneColor: string | null;
  capillaryRefillTime: string | null;
  mentation: string | null;
  // When the readings were measured, if known (4.11a); recordedAt is entry time.
  occurredAt: string | null;
  recordedAt: string;
  recordedBy: CaseReference | null;
}

export interface PainScore {
  id: string;
  score: number;
  notes: string | null;
  // When the pain was scored, if known (4.11a); recordedAt is entry time.
  occurredAt: string | null;
  recordedAt: string;
  recordedBy: CaseReference | null;
}

export interface CaseTask {
  id: string;
  type: CaseTaskType;
  description: string;
  status: CaseTaskStatus;
  dueAt: string | null;
  assignedTo: CaseReference | null;
  createdAt: string;
  createdBy: CaseReference | null;
  resolvedAt: string | null;
  resolvedBy: CaseReference | null;
}

// The next due item of one type: the panel's "Next reassessment" and
// "Client update" rows.
export interface CaseDueItem {
  id: string;
  description: string;
  dueAt: string | null;
  assignedTo: CaseReference | null;
}

export interface CaseEvent {
  id: string;
  type: CaseEventType;
  description: string;
  createdAt: string;
  createdBy: CaseReference | null;
}

// A new task, blocker or due item, as POST /api/cases/{id}/tasks takes it
// (4.4a). A reassessment or client update needs dueAt.
export interface CaseTaskRequest {
  type: CaseTaskType;
  description: string;
  dueAt?: string;
  assignedToStaffId?: string;
}
