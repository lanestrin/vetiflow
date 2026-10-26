import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";

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
    ...overrides
  };
}
