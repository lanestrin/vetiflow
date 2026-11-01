import type { PatientListItem } from "../types/PatientListItem";
import type { PatientVisitHistory } from "../types/PatientVisitHistory";
import { authorizationHeader, throwIfRefused } from "./apiRequest";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// Patients whose name or owner's name contains the text (build plan 4.6a).
// The API returns at most 25.
export async function searchPatients(text: string, signal?: AbortSignal): Promise<PatientListItem[]> {
  const response = await fetch(`${apiBaseUrl}/api/patients?search=${encodeURIComponent(text)}`, {
    headers: authorizationHeader(),
    signal
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to search patients.");
  }

  return response.json();
}

// The patient's profile header and ER visits (build plan 4.21b), or null when
// no such patient exists.
export async function getPatientVisitHistory(patientId: string, signal?: AbortSignal): Promise<PatientVisitHistory | null> {
  const response = await fetch(`${apiBaseUrl}/api/patients/${encodeURIComponent(patientId)}/visits`, {
    headers: authorizationHeader(),
    signal
  });

  throwIfRefused(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load visit history.");
  }

  return response.json();
}
