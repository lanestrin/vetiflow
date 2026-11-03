import type { AcuityLevel } from "../../types/EmergencyCaseListItem";

// The badge's words, for an accessible name that repeats them (3.2f).
export function acuityBadgeLabel(acuity: AcuityLevel | null, isProvisional = false): string {
  if (acuity === null) return "Not triaged";
  const label = {
    critical: "Critical",
    urgent: "Urgent",
    stable: "Stable"
  }[acuity];
  return isProvisional ? `${label} · provisional` : label;
}
