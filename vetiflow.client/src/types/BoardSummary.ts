export type ShiftName = "day" | "night";

// The numbers behind the board's stat cards (GET /api/board/summary, 2.12a).
export interface BoardSummary {
  // The heading's eyebrow and shift chip (2.15a).
  clinicName: string;
  // Active veterinarians and technicians not Unavailable.
  cliniciansOnFloor: number;
  patientsInCare: number;
  shift: {
    name: ShiftName;
    startedAt: string;
  };
  // Of the patients in care, those who arrived since the shift began.
  arrivedThisShift: number;
  awaitingTriage: number;
  // The longest wait's arrival; null when nothing awaits triage.
  oldestAwaitingTriageArrivedAt: string | null;
  criticalPatients: number;
  // Critical cases with neither a doctor nor a technician assigned.
  criticalWithoutCareTeam: number;
}
