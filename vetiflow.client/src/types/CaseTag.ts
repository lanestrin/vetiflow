import type { CaseReference } from "./EmergencyCaseListItem";

// How a tag is coloured on the board (build plan 3.5b). Alert, caution and info
// follow the prototype's red, amber and blue tags; neutral is the grey default.
export type CaseTagTone = "alert" | "caution" | "info" | "neutral";

// A short standing label on a case (build plan 3.5a), oldest first on the case.
export interface CaseTag {
  id: string;
  text: string;
  tone: CaseTagTone;
  createdAt: string;
  createdBy: CaseReference | null;
}

// A new tag, as POST /api/cases/{id}/tags takes it.
export interface CaseTagRequest {
  text: string;
  tone: CaseTagTone;
}
