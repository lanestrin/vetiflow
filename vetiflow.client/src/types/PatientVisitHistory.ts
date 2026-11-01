// A patient's profile header and ER visits, newest first
// (GET /api/patients/{id}/visits, build plan 4.21b). It never carries the
// owner, contact details or intake notes.
export interface PatientVisitHistory {
  patient: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
  };
  visits: PatientVisit[];
}

export interface PatientVisit {
  caseId: string;
  caseNumber: string;
  arrivalTime: string;
  presentingComplaint: string;
  // Null while the visit is still active.
  dischargedAt: string | null;
  attendingDoctor: { id: string; name: string } | null;
}
