import type {
  CaseStage,
  EmergencyCaseListItem
} from "../types/EmergencyCaseListItem";
import { AccessDeniedError, SessionEndedError } from "./apiErrors";
import { readAccessToken } from "./session";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// The board API needs a hospital team member's token (build plan S.18b).
function authorizationHeader(): Record<string, string> {
  const accessToken = readAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function throwIfRefused(response: Response): void {
  if (response.status === 401) {
    throw new SessionEndedError();
  }

  if (response.status === 403) {
    throw new AccessDeniedError();
  }
}

export async function getEmergencyCases(): Promise<EmergencyCaseListItem[]> {
  const response = await fetch(`${apiBaseUrl}/api/cases`, {
    headers: authorizationHeader()
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to load emergency cases.");
  }

  return response.json();
}

export async function updateCaseStage(
  caseId: string,
  stage: CaseStage
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/api/cases/${caseId}/stage`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authorizationHeader()
      },
      body: JSON.stringify({ stage })
    }
  );

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to update case stage.");
  }
}
