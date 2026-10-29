import type { CaseStage, CaseStatus, EmergencyCaseListItem, WaitChip } from "../../types/EmergencyCaseListItem";

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
export interface BoardMenuFilters {
  clinicianId: string | null;
  species: string | null;
  status: CaseStatus | null;
}

export const noMenuFilters: BoardMenuFilters = { clinicianId: null, species: null, status: null };

export const unassignedClinician = "unassigned";

// A card shows when it matches every filter in use.
export function matchesMenuFilters(emergencyCase: EmergencyCaseListItem, filters: BoardMenuFilters): boolean {
  if (filters.clinicianId !== null) {
    const clinicianId = emergencyCase.clinician?.id ?? unassignedClinician;
    if (clinicianId !== filters.clinicianId) {
      return false;
    }
  }

  if (filters.species !== null && emergencyCase.species !== filters.species) {
    return false;
  }

  return filters.status === null || emergencyCase.status === filters.status;
}
