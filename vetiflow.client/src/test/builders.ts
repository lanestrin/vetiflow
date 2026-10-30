import type { SignedInUser } from "../types/Auth";
import type { BoardSummary } from "../types/BoardSummary";
import type { CaseDetail, CaseTask } from "../types/CaseDetail";
import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";
import type { PatientListItem } from "../types/PatientListItem";

let nextId = 1;

// A valid case with sensible defaults; pass only what the test cares about.
export function buildCase(
  overrides: Partial<EmergencyCaseListItem> = {}
): EmergencyCaseListItem {
  const id = nextId++;

  return {
    id: `case-${id}`,
    caseNumber: `ER-${2400 + id}`,
    patientId: `patient-${id}`,
    patientName: `Patient ${id}`,
    species: "Dog",
    breed: "Beagle",
    patientDateOfBirth: null,
    ownerName: null,
    weightKg: 12.4,
    presentingComplaint: "Vomiting",
    stage: "treatment",
    stageEnteredAt: new Date().toISOString(),
    status: "waiting",
    acuity: "stable",
    arrivalTime: new Date().toISOString(),
    nextAction: null,
    assignedDoctor: null,
    assignedTechnician: null,
    room: null,
    clinician: null,
    waitChip: "minutes",
    blockers: [],
    lastUpdated: new Date().toISOString(),
    ...overrides
  };
}

// A case as the detail endpoint returns it: no owner, vitals, tasks or events
// unless the test adds them.
export function buildCaseDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const id = nextId++;

  return {
    id: `case-${id}`,
    caseNumber: `ER-${2400 + id}`,
    patient: {
      id: `patient-${id}`,
      name: `Patient ${id}`,
      species: "Dog",
      breed: "Beagle",
      sex: null,
      dateOfBirth: null,
      dateOfBirthIsEstimated: false,
      allergies: null,
      currentMedications: null
    },
    owner: null,
    presentingComplaint: "Vomiting",
    weightKg: 12.4,
    stage: "treatment",
    stageEnteredAt: new Date().toISOString(),
    status: "waiting",
    acuity: "stable",
    arrivalTime: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    dischargedAt: null,
    nextAction: null,
    assignedDoctor: null,
    assignedTechnician: null,
    room: null,
    allergiesAtIntake: null,
    medicationsAtIntake: null,
    treatmentAuthorization: "notDiscussed",
    referringClinic: null,
    ownerUpdateStatus: "notYetUpdated",
    lastOwnerUpdateAt: null,
    triageAssessments: [],
    vitals: [],
    latestPainScore: null,
    tasks: [],
    nextReassessment: null,
    nextClientUpdate: null,
    timeline: [],
    ...overrides
  };
}

export function buildCaseTask(overrides: Partial<CaseTask> = {}): CaseTask {
  return {
    id: crypto.randomUUID(),
    type: "task",
    description: "A task",
    status: "open",
    dueAt: null,
    assignedTo: null,
    createdAt: new Date().toISOString(),
    createdBy: null,
    resolvedAt: null,
    resolvedBy: null,
    ...overrides
  };
}

// A patient search result with an owner, not in care.
export function buildPatientListItem(
  overrides: Partial<PatientListItem> = {}
): PatientListItem {
  const id = nextId++;

  return {
    id: `patient-${id}`,
    name: `Patient ${id}`,
    species: "Dog",
    breed: "Beagle",
    ownerId: `owner-${id}`,
    ownerName: `Owner ${id}`,
    inCare: false,
    ...overrides
  };
}

// The demo team member, as GET /api/auth/me returns them.
export function buildTeamMember(overrides: Partial<SignedInUser> = {}): SignedInUser {
  return {
    name: "Jordan Lee",
    experience: "teamMember",
    displayName: "Dr. Jordan Lee",
    initials: "JL",
    ...overrides
  };
}

// The demo pet parent, as GET /api/auth/me returns them.
export function buildPetParent(overrides: Partial<SignedInUser> = {}): SignedInUser {
  return {
    name: "Morgan Hale",
    experience: "petParent",
    displayName: "Morgan Hale",
    initials: "MH",
    ...overrides
  };
}

// A quiet board: nothing awaiting triage and no critical patients.
export function buildBoardSummary(overrides: Partial<BoardSummary> = {}): BoardSummary {
  return {
    clinicName: "Northside Veterinary Emergency",
    cliniciansOnFloor: 0,
    patientsInCare: 0,
    shift: { name: "day", startedAt: new Date().toISOString() },
    arrivedThisShift: 0,
    awaitingTriage: 0,
    oldestAwaitingTriageArrivedAt: null,
    criticalPatients: 0,
    criticalWithoutCareTeam: 0,
    ...overrides
  };
}
