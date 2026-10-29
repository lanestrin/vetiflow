// My status (build plan 2.21a): the API's StaffStatus values.
export type StaffStatus = "available" | "busy" | "atLimit" | "unavailable";

// The prototype's option order (#availabilityStatus).
export const staffStatusOptions: StaffStatus[] = ["busy", "available", "atLimit", "unavailable"];

const staffStatusLabels: Record<StaffStatus, string> = {
  available: "Available",
  busy: "Busy",
  atLimit: "At limit",
  unavailable: "Unavailable"
};

export function staffStatusLabel(status: StaffStatus): string {
  return staffStatusLabels[status];
}

// A clinician on the floor, as GET /api/staff/on-floor returns them (2.21a).
export interface OnFloorClinician {
  id: string;
  // "Dr. Jordan Lee" for a veterinarian, otherwise the name.
  displayName: string;
  initials: string;
  role: string;
  status: StaffStatus;
  activeCaseCount: number;
}
