import type { EmergencyCaseListItem } from "../types/EmergencyCaseListItem";

export async function getEmergencyCases(): Promise<EmergencyCaseListItem[]> {
  const response = await fetch("/api/cases");

  if (!response.ok) {
    throw new Error("Failed to load emergency cases.");
  }

  return response.json();
}