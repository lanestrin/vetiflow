// A patient in records search results (GET /api/patients?search=). It never
// carries the owner's contact details.
export interface PatientListItem {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  // Both null when no owner is recorded (a stray, or not known yet).
  ownerId: string | null;
  ownerName: string | null;
  inCare: boolean;
}
