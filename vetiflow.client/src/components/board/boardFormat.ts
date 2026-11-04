import type { BoardSummary } from "../../types/BoardSummary";
import type { AcuityLevel, CaseStage, CaseStatus, EmergencyCaseListItem, WaitChip } from "../../types/EmergencyCaseListItem";

// Staff wording for the patient flow cards (build plan 2.11b). The API sends
// enum values; the words live here.

const minute = 60_000;

export function minutesSince(isoTime: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(isoTime).getTime()) / minute));
}

// Whole months from a "2018-04-02" date of birth to now.
export function ageInMonths(dateOfBirth: string, now: Date): number {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const months = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
  return now.getUTCDate() < day ? months - 1 : months;
}

// "8y", or months under one year ("6mo", "<1mo"). Worked out on screen so it
// never goes stale.
export function ageLabel(dateOfBirth: string | null, now: Date): string | null {
  if (dateOfBirth === null) {
    return null;
  }

  const months = ageInMonths(dateOfBirth, now);
  if (months >= 12) {
    return `${Math.floor(months / 12)}y`;
  }

  return months >= 1 ? `${months}mo` : "<1mo";
}

const chipLabels: Record<Exclude<WaitChip, "minutes">, string> = {
  stat: "STAT",
  ready: "Ready",
  recheck: "Recheck",
  new: "New"
};

export function waitChipLabel(chip: WaitChip, arrivalTime: string, now: Date): string {
  return chip === "minutes" ? `${minutesSince(arrivalTime, now)} min` : chipLabels[chip];
}

const stageLabels: Record<CaseStage, string> = {
  incoming: "Awaiting triage",
  triage: "Triage",
  treatment: "In treatment",
  diagnostics: "Diagnostics",
  recheck: "Recheck",
  discharge: "Discharge"
};

export function stageLabel(stage: CaseStage): string {
  return stageLabels[stage];
}

// The top bar's search on the board (build plan 2.14a): the text, trimmed and
// in any case, anywhere in the fields a card shows. Empty matches every card.
export function matchesSearch(emergencyCase: EmergencyCaseListItem, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (text === "") {
    return true;
  }

  const fields = [
    emergencyCase.patientName,
    emergencyCase.caseNumber,
    emergencyCase.ownerName,
    emergencyCase.species,
    emergencyCase.breed,
    emergencyCase.presentingComplaint
  ];

  return fields.some((field) => field?.toLowerCase().includes(text) ?? false);
}

const statusLabels: Record<CaseStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  waiting: "Waiting",
  inProgress: "In progress",
  blocked: "Blocked",
  readyForNextStep: "Ready for next step",
  completed: "Completed"
};

export function caseStatusLabel(status: CaseStatus): string {
  return statusLabels[status];
}

// The board's Filter menu (build plan 2.14c). Null means any; "unassigned"
// means a card with no clinician.
// The Unassigned toggle (2.26b): a primary technician or an attending
// veterinarian is missing, or both.
export function matchesUnassigned(emergencyCase: EmergencyCaseListItem): boolean {
  return emergencyCase.assignedTechnician === null || emergencyCase.assignedDoctor === null;
}

export interface BoardMenuFilters {
  acuity: AcuityLevel | null;
  // A staff member's id, or noTechnician / noVeterinarian (2.26c).
  staff: string | null;
  species: string | null;
  status: CaseStatus | null;
}

export const noMenuFilters: BoardMenuFilters = { acuity: null, staff: null, species: null, status: null };

// The Staff filter's two missing-assignment choices; never a staff id.
export const noTechnician = "no-technician";
export const noVeterinarian = "no-veterinarian";

// Staff matches a case where that person is the primary technician or the
// attending veterinarian (2.26c).
function matchesStaff(emergencyCase: EmergencyCaseListItem, staff: string): boolean {
  if (staff === noTechnician) return emergencyCase.assignedTechnician === null;
  if (staff === noVeterinarian) return emergencyCase.assignedDoctor === null;
  return emergencyCase.assignedTechnician?.id === staff || emergencyCase.assignedDoctor?.id === staff;
}

// A card shows when it matches every filter in use.
export function matchesMenuFilters(emergencyCase: EmergencyCaseListItem, filters: BoardMenuFilters): boolean {
  if (filters.acuity !== null && emergencyCase.acuity !== filters.acuity) {
    return false;
  }

  if (filters.staff !== null && !matchesStaff(emergencyCase, filters.staff)) {
    return false;
  }

  if (filters.species !== null && emergencyCase.species !== filters.species) {
    return false;
  }

  return filters.status === null || emergencyCase.status === filters.status;
}

// The stats strip's Critical without vet (build plan 2.26a): critical with no
// attending veterinarian; a technician alone does not count.
export function isCriticalWithoutVet(emergencyCase: EmergencyCaseListItem): boolean {
  return emergencyCase.acuity === "critical" && emergencyCase.assignedDoctor === null;
}

// The board's Priority button (build plan 2.14d): longest in the current stage
// first. The sort is stable, so ties keep the API's priority order.
export function sortByLongestInStage(cases: EmergencyCaseListItem[]): EmergencyCaseListItem[] {
  return cases.toSorted((first, second) =>
    new Date(first.stageEnteredAt).getTime() - new Date(second.stageEnteredAt).getTime());
}

// The heading's shift chip (build plan 2.15b): "Day shift · 4 clinicians on floor".
export function shiftChipLabel(summary: BoardSummary): string {
  const shift = summary.shift.name === "day" ? "Day shift" : "Night shift";
  const clinicians = summary.cliniciansOnFloor === 1
    ? "1 clinician on floor"
    : `${summary.cliniciansOnFloor} clinicians on floor`;
  return `${shift} · ${clinicians}`;
}

// Door to doctor (build plan 2.16b): this shift's average minus last shift's,
// in minutes; null unless both shifts have an average.
export function doorToDoctorChange(summary: BoardSummary): number | null {
  const { currentShift, previousShift } = summary.doorToDoctor;
  if (currentShift.averageMinutes === null || previousShift.averageMinutes === null) {
    return null;
  }

  return currentShift.averageMinutes - previousShift.averageMinutes;
}

function changeMark(change: number): string {
  if (change < 0) return `↓${-change}`;
  if (change > 0) return `↑${change}`;
  return "=";
}

// The heading chip's text: "Door to doctor · 14 min ↓4", or "· —" before
// anyone has been assessed this shift.
export function doorToDoctorChipLabel(summary: BoardSummary): string {
  const average = summary.doorToDoctor.currentShift.averageMinutes;
  if (average === null) {
    return "Door to doctor · —";
  }

  const change = doorToDoctorChange(summary);
  return `Door to doctor · ${average} min${change === null ? "" : ` ${changeMark(change)}`}`;
}

function minutesText(minutes: number): string {
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

// The change in words, never by arrow or colour alone: "4 min faster than
// last shift". Null without both averages.
export function doorToDoctorChangeSentence(summary: BoardSummary): string | null {
  const change = doorToDoctorChange(summary);
  if (change === null) return null;
  if (change === 0) return "Same as last shift";
  return `${Math.abs(change)} min ${change < 0 ? "faster" : "slower"} than last shift`;
}

// The chip's accessible name, with the arrow spelled out.
export function doorToDoctorChipName(summary: BoardSummary): string {
  const average = summary.doorToDoctor.currentShift.averageMinutes;
  if (average === null) {
    return "Door to doctor, no assessments yet this shift";
  }

  const change = doorToDoctorChange(summary);
  const changeText = change === null ? ""
    : change === 0 ? ", same as last shift"
    : `, ${minutesText(Math.abs(change))} ${change < 0 ? "faster" : "slower"} than last shift`;
  return `Door to doctor, ${minutesText(average)} this shift${changeText}`;
}

// Show waiting patients (2.16b): no vet assessment recorded yet, the same
// patients the summary counts as waiting.
export function isAwaitingVet(emergencyCase: EmergencyCaseListItem): boolean {
  return emergencyCase.vetAssessment === null;
}
