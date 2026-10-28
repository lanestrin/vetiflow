import type { CaseStage, WaitChip } from "../../types/EmergencyCaseListItem";

// Staff wording for the patient flow cards (build plan 2.11b). The API sends
// enum values; the words live here.

const minute = 60_000;

export function minutesSince(isoTime: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(isoTime).getTime()) / minute));
}

// "8y", or months under one year ("6mo", "<1mo"). Worked out on screen so it
// never goes stale.
export function ageLabel(dateOfBirth: string | null, now: Date): string | null {
  if (dateOfBirth === null) {
    return null;
  }

  const [year, month, day] = dateOfBirth.split("-").map(Number);
  let months = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
  if (now.getUTCDate() < day) {
    months -= 1;
  }

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
