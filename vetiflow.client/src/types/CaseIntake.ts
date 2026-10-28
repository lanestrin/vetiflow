import type { AcuityLevel } from "./EmergencyCaseListItem";

export type TreatmentAuthorization = "notDiscussed" | "pending" | "authorized" | "declined";

// The New patient intake form (POST /api/cases/intake, build plan 4.1a).
// Blank optional fields are sent as null.
export interface CaseIntakeRequest {
  petName: string;
  species: string;
  breed: string | null;
  age: string | null;
  ownerName: string;
  ownerPhone: string;
  chiefComplaint: string;
  priority: AcuityLevel;
  triageNotes: string | null;
  allergies: string | null;
  medications: string | null;
  treatmentAuthorization: TreatmentAuthorization;
  referringClinic: string | null;
}

export interface CaseIntakeResult {
  id: string;
  caseNumber: string;
  patientId: string;
}

// The form's fields, as the API names them in its field errors.
export type IntakeField = keyof CaseIntakeRequest;
