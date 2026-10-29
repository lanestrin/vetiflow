import type { BoardSummary } from "../types/BoardSummary";
import { authorizationHeader, throwIfRefused } from "./apiRequest";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// The stat cards' numbers (build plan 2.12b), reloaded with the board.
export async function getBoardSummary(): Promise<BoardSummary> {
  const response = await fetch(`${apiBaseUrl}/api/board/summary`, {
    headers: authorizationHeader()
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to load the board summary.");
  }

  return response.json();
}
