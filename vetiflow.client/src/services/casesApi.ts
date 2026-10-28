import type {
  CaseStage,
  EmergencyCaseListItem
} from "../types/EmergencyCaseListItem";
import { authorizationHeader, throwIfRefused } from "./apiRequest";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

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
