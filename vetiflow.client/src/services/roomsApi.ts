import type { Room } from "../types/Room";
import { authorizationHeader, throwIfRefused } from "./apiRequest";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// Every room by name, with the active case in each, for Change location
// (build plan 4.3b).
export async function getRooms(): Promise<Room[]> {
  const response = await fetch(`${apiBaseUrl}/api/rooms`, {
    headers: authorizationHeader()
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to load rooms.");
  }

  return response.json();
}
