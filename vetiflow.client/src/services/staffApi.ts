import type { OnFloorClinician, StaffStatus } from "../types/StaffStatus";
import { authorizationHeader, throwIfRefused } from "./apiRequest";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// The signed-in clinician's My status (build plan 2.21b). Other staff get 403.
export async function getMyStatus(): Promise<StaffStatus> {
  const response = await fetch(`${apiBaseUrl}/api/staff/me/status`, {
    headers: authorizationHeader()
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to load my status.");
  }

  const body: { status: StaffStatus } = await response.json();
  return body.status;
}

export async function setMyStatus(status: StaffStatus): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/staff/me/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authorizationHeader()
    },
    body: JSON.stringify({ status })
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to save my status.");
  }
}

// The clinicians on the floor, the Add task form's assignees (build plan 4.4c).
export async function getCliniciansOnFloor(): Promise<OnFloorClinician[]> {
  const response = await fetch(`${apiBaseUrl}/api/staff/on-floor`, {
    headers: authorizationHeader()
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to load the clinicians on the floor.");
  }

  return response.json();
}
