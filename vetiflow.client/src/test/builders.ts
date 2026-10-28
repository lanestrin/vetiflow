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
    patientId: `patient-${id}`,
    patientName: `Patient ${id}`,
    species: "Dog",
    breed: "Beagle",
    weightKg: 12.4,
    presentingComplaint: "Vomiting",
    stage: "incoming",
    status: "waiting",
    acuity: "high",
    arrivalTime: new Date().toISOString(),
    nextAction: null,
    assignedDoctor: null,
    assignedTechnician: null,
    room: null,
    blockers: [],
    lastUpdated: new Date().toISOString(),
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
