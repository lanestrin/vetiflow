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

// Who completed a done task, else who it is with; "Pending" for an open task
// nobody has yet (4.4b).
export function taskMeta(task: CaseTask): string {
  if (task.status === "done") {
    return task.resolvedBy?.name ?? "Done";
  }

  return task.assignedTo?.name ?? "Pending";
}

const minute = 60_000;

// "12 min", or "1 h 5 min" from an hour.
function minutesLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

// The due rows (build plan 4.4b): "Overdue by 12 min", "Due now", "Due in 8
// min" within the hour, then "Due 11:15 AM". "Not scheduled" with nothing due.
export function dueLabel(dueAt: string | null, now: Date): string {
  if (dueAt === null) {
    return "Not scheduled";
  }

  const untilDue = new Date(dueAt).getTime() - now.getTime();
  if (untilDue < 0) {
    return `Overdue by ${minutesLabel(Math.max(1, Math.floor(-untilDue / minute)))}`;
  }

  const minutes = Math.floor(untilDue / minute);
  if (minutes === 0) {
    return "Due now";
  }

  return minutes < 60 ? `Due in ${minutes} min` : `Due ${timeLabel(dueAt, now)}`;
}

const hour = 60 * minute;
const day = 24 * hour;
const datedFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function validTime(isoTime: string | null | undefined): Date | null {
  const time = new Date(isoTime ?? Number.NaN);
  return isoTime && Number.isFinite(time.getTime()) ? time : null;
}

function wallClock(time: Date): string {
  return `${time.toDateString()} ${time.getHours()}:${time.getMinutes()}`;
}

// The zone name only where the local clock repeats an hour (daylight saving
// ending), so "1:30 AM EDT" and "1:30 AM EST" stay distinct.
function repeatedHourZone(time: Date): string {
  const repeated = [-hour, hour].some(offset => wallClock(new Date(time.getTime() + offset)) === wallClock(time));
  if (!repeated) {
    return "";
  }

  const zone = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(time).find(part => part.type === "timeZoneName");
  return zone ? ` ${zone.value}` : "";
}

// A record's absolute local time (4.11b): timeLabel, with the year when it
// differs from now's. Null for a missing or invalid time.
export function recordTimeLabel(isoTime: string | null | undefined, now: Date): string | null {
  const time = validTime(isoTime);
  if (time === null) {
    return null;
  }

  const label = time.getFullYear() === now.getFullYear()
    ? timeLabel(time.toISOString(), now)
    : `${datedFormat.format(time)}, ${timeFormat.format(time)}`;
  return label + repeatedHourZone(time);
}

// How long ago a measurement was taken (4.11b): elapsed age only, rounded
// down, never a clinical judgement. Entry time is never used in its place.
export function measuredAgeLabel(occurredAt: string | null | undefined, now: Date): string {
  if (occurredAt === null || occurredAt === undefined) {
    return "Measurement time unknown";
  }

  const time = validTime(occurredAt);
  if (time === null) {
    return "Measurement time unavailable";
  }

  const elapsed = now.getTime() - time.getTime();
  if (elapsed < 0) {
    return "Measurement time is in the future";
  }

  if (elapsed < minute) {
    return "Measured less than 1 min ago";
  }

  const age = elapsed < hour
    ? `${Math.floor(elapsed / minute)} min`
    : elapsed < day
      ? plural(Math.floor(elapsed / hour), "hour")
      : plural(Math.floor(elapsed / day), "day");
  return `Measured ${age} ago`;
}

export function isOverdue(dueAt: string | null, now: Date): boolean {
  return dueAt !== null && new Date(dueAt).getTime() < now.getTime();
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

// The due time form's first value (4.4c): "HH:MM" for half an hour from now,
// rounded up to 5 minutes.
export function defaultDueTime(now: Date): string {
  const fiveMinutes = 5 * minute;
  const due = new Date(Math.ceil((now.getTime() + 30 * minute) / fiveMinutes) * fiveMinutes);
  return `${twoDigits(due.getHours())}:${twoDigits(due.getMinutes())}`;
}

// The ISO time for an "HH:MM" from the due time form (4.4c): today, or
// tomorrow once that minute has passed, so 12:20 AM can be set at 11:50 PM.
// Null for anything that is not a time.
export function dueAtFromTime(time: string, now: Date): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    return null;
  }

  const due = new Date(now);
  due.setHours(Number(match[1]), Number(match[2]), 0, 0);
  const thisMinute = new Date(now);
  thisMinute.setSeconds(0, 0);
  if (due < thisMinute) {
    due.setDate(due.getDate() + 1);
  }

  return due.toISOString();
}

export type SpeciesKind = "dog" | "cat" | "other";

export function speciesKind(species: string): SpeciesKind {
  const name = species.trim().toLowerCase();
  if (name === "dog" || name === "canine") {
    return "dog";
  }

  return name === "cat" || name === "feline" ? "cat" : "other";
}
