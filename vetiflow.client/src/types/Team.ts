import type { StaffStatus } from "./StaffStatus";

// One active case on a clinician's list (build plan 4.5).
export interface TeamCase {
  id: string;
  caseNumber: string;
  patientName: string;
}

// A veterinarian or technician on the team, as GET /api/staff/team returns them
// (build plan 4.5). Never contact details.
export interface TeamClinician {
  id: string;
  // "Dr. Jordan Lee" for a veterinarian, otherwise the name.
  displayName: string;
  initials: string;
  role: string;
  status: StaffStatus;
  activeCaseCount: number;
  activeCases: TeamCase[];
}
