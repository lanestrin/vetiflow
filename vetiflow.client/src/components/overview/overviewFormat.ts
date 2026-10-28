import type { CaseEvent, CaseEventType, CaseTask } from "../../types/CaseDetail";
import type { CaseRoom, RoomType } from "../../types/EmergencyCaseListItem";
import { ageInMonths } from "../board/boardFormat";

// Staff wording for the patient overview panel (build plan 3.2b). The API
// sends enum values and times; the words live here.

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function isSameLocalDay(first: Date, second: Date): boolean {
  return first.toDateString() === second.toDateString();
}

// "10:42 AM", with the day when it was not today ("27 Oct, 10:42 PM").
export function timeLabel(isoTime: string, now: Date): string {
  const time = new Date(isoTime);
  return isSameLocalDay(time, now)
    ? timeFormat.format(time)
    : `${dayFormat.format(time)}, ${timeFormat.format(time)}`;
}

export function checkInLabel(arrivalTime: string, now: Date): string {
  return `Checked in ${timeLabel(arrivalTime, now)}`;
}

function plural(count: number, unit: string): string {
  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
}

// "8 years", or months under one year ("6 months", "Under 1 month").
export function longAgeLabel(dateOfBirth: string | null, now: Date): string | null {
  if (dateOfBirth === null) {
    return null;
  }

  const months = ageInMonths(dateOfBirth, now);
  if (months >= 12) {
    return plural(Math.floor(months / 12), "year");
  }

  return months >= 1 ? plural(months, "month") : "Under 1 month";
}

export function weightLabel(weightKg: number | null): string | null {
  return weightKg === null ? null : `${weightKg} kg`;
}

// The stored °F as the prototype's °C, to one decimal.
export function temperatureLabel(temperatureF: number | null): string | null {
  return temperatureF === null ? null : `${((temperatureF - 32) * 5 / 9).toFixed(1)} °C`;
}

const areaLabels: Record<RoomType, string> = {
  exam: "Exam",
  treatment: "Treatment",
  icu: "ICU",
  oxygen: "Oxygen",
  isolation: "Isolation",
  surgery: "Surgery",
  imaging: "Imaging"
};

// "Treatment · Oxygen Cage": the area from the room type, then the room.
export function locationLabel(room: CaseRoom | null): string {
  return room === null ? "No room assigned" : `${areaLabels[room.type]} · ${room.name}`;
}

const eventLabels: Record<CaseEventType, string> = {
  arrived: "Arrived",
  triaged: "Triage completed",
  assigned: "Care team assigned",
  stageChanged: "Stage changed",
  statusChanged: "Status changed",
  roomChanged: "Room changed",
  noteAdded: "Note added",
  diagnosticOrdered: "Diagnostic ordered",
  diagnosticCompleted: "Diagnostic completed",
  treatmentStarted: "Treatment started",
  treatmentCompleted: "Treatment completed",
  discharged: "Discharged"
};

export function eventLabel(type: CaseEventType): string {
  return eventLabels[type];
}

// "Triage level 1 · Dr. Jordan Reed": what happened, then who did it.
export function eventDetail(caseEvent: CaseEvent): string {
  return caseEvent.createdBy
    ? `${caseEvent.description} · ${caseEvent.createdBy.name}`
    : caseEvent.description;
}

// Who the task is with; "Pending" for an open task nobody has yet.
export function taskMeta(task: CaseTask): string {
  if (task.assignedTo) {
    return task.assignedTo.name;
  }

  return task.status === "done" ? "Done" : "Pending";
}

export type SpeciesKind = "dog" | "cat" | "other";

export function speciesKind(species: string): SpeciesKind {
  const name = species.trim().toLowerCase();
  if (name === "dog" || name === "canine") {
    return "dog";
  }

  return name === "cat" || name === "feline" ? "cat" : "other";
}
