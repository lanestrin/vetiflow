import type {
  CaseStage,
  EmergencyCaseListItem
} from "../types/EmergencyCaseListItem";
import type { CaseDetail } from "../types/CaseDetail";
import type { CaseIntakeRequest, CaseIntakeResult } from "../types/CaseIntake";
import type { TriageRequest } from "../types/Triage";
import { CaseGoneError, FormRejectedError } from "./apiErrors";
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

// One case for the patient overview panel (build plan 3.2b), or null when no
// case has that id.
export async function getCase(caseId: string): Promise<CaseDetail | null> {
  const response = await fetch(`${apiBaseUrl}/api/cases/${caseId}`, {
    headers: authorizationHeader()
  });

  throwIfRefused(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load the case.");
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

// Adds an arriving pet to the triage queue (build plan 4.1a). A 400 brings the
// first message for each field the API refused.
export async function createIntake(request: CaseIntakeRequest): Promise<CaseIntakeResult> {
  const response = await fetch(`${apiBaseUrl}/api/cases/intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authorizationHeader()
    },
    body: JSON.stringify(request)
  });

  throwIfRefused(response);

  if (response.status === 400) {
    throw new FormRejectedError(await readFieldErrors(response));
  }

  if (!response.ok) {
    throw new Error("Failed to add the patient.");
  }

  return response.json();
}

// Completes triage on an incoming case or re-triages a later one (build plan
// 4.2b). The board and panel reload afterwards; other boards hear caseUpdated.
export async function triageCase(caseId: string, request: TriageRequest): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/cases/${caseId}/triage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authorizationHeader()
    },
    body: JSON.stringify(request)
  });

  throwIfRefused(response);

  if (response.status === 400) {
    throw new FormRejectedError(await readFieldErrors(response));
  }

  if (response.status === 404) {
    throw new CaseGoneError("notFound");
  }

  if (response.status === 409) {
    throw new CaseGoneError("discharged");
  }

  if (!response.ok) {
    throw new Error("Failed to save triage.");
  }
}

async function readFieldErrors(response: Response): Promise<Record<string, string>> {
  const fieldErrors: Record<string, string> = {};

  try {
    const problem: unknown = await response.json();
    if (typeof problem === "object" && problem !== null && "errors" in problem
      && typeof problem.errors === "object" && problem.errors !== null) {
      for (const [field, messages] of Object.entries(problem.errors)) {
        if (Array.isArray(messages) && typeof messages[0] === "string") {
          fieldErrors[field] = messages[0];
        }
      }
    }
  } catch {
    // A 400 without a readable body still counts as refused.
  }

  return fieldErrors;
}
