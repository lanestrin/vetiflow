import type { VitalsRecord } from "../../types/CaseDetail";
import { temperatureLabel } from "./overviewFormat";

// How one saved vitals set differs from the set saved before it (build plan
// 4.8g). Facts only: a value is compared as staff see it, and the wording
// never says better or worse.
export interface VitalsChanges {
  changed: { label: string; from: string; to: string }[];
  // Recorded in this set, not in the previous one.
  added: { label: string; value: string }[];
  // Recorded in the previous set, not in this one.
  missing: { label: string; previous: string }[];
  unchanged: { label: string; value: string }[];
}

function text(value: string | null): string | null {
  return value?.trim() || null;
}

// In the Clinical drawer's order, each shown as the drawers show it.
const readings: { label: string; value: (record: VitalsRecord) => string | null }[] = [
  { label: "Heart rate", value: record => record.heartRate === null ? null : `${record.heartRate} bpm` },
  { label: "Respiratory rate", value: record => record.respiratoryRate === null ? null : `${record.respiratoryRate} /min` },
  { label: "Temperature", value: record => temperatureLabel(record.temperatureF) },
  { label: "SpO₂", value: record => record.spO2 === null ? null : `${record.spO2}%` },
  { label: "Mucous membrane colour", value: record => text(record.mucousMembraneColor) },
  { label: "Capillary refill time", value: record => text(record.capillaryRefillTime) },
  { label: "Mentation", value: record => text(record.mentation) }
];

export function vitalsChanges(current: VitalsRecord, previous: VitalsRecord): VitalsChanges {
  const changes: VitalsChanges = { changed: [], added: [], missing: [], unchanged: [] };

  for (const { label, value } of readings) {
    const now = value(current);
    const before = value(previous);
    if (now !== null && before !== null) {
      if (now === before) changes.unchanged.push({ label, value: now });
      else changes.changed.push({ label, from: before, to: now });
    } else if (now !== null) {
      changes.added.push({ label, value: now });
    } else if (before !== null) {
      changes.missing.push({ label, previous: before });
    }
  }

  return changes;
}
