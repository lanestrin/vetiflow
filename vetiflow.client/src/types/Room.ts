import type { RoomType } from "./EmergencyCaseListItem";

// One room as GET /api/rooms returns it (build plan 4.3a), with the active case
// in it, if any.
export interface Room {
  id: string;
  name: string;
  type: RoomType;
  occupiedBy: RoomCase | null;
}

export interface RoomCase {
  id: string;
  // "ER-2481".
  caseNumber: string;
}
