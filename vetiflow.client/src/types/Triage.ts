import type { AcuityLevel } from "./EmergencyCaseListItem";

// Complete triage or re-triage (build plan 4.2a). Notes are clinical text.
export interface TriageRequest {
  priority: AcuityLevel;
  notes: string | null;
}
