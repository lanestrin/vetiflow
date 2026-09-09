import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getEmergencyCases(): Promise<EmergencyCaseListItem[]> {
  const response = await fetch(`${apiBaseUrl}/api/cases`);

  if (!response.ok) {
    throw new Error("Failed to load emergency cases.");
  }

  return response.json();
}