import type {
  EmergencyCaseListItem
} from "../types/EmergencyCaseListItem";
import type { CaseDetail, CaseTaskRequest } from "../types/CaseDetail";
import type { CaseIntakeRequest, CaseIntakeResult } from "../types/CaseIntake";
import type { TriageRequest } from "../types/Triage";
import type { RecordVitalsRequest } from "../types/RecordVitalsRequest";
import type { PainScoreRequest } from "../types/PainScoreRequest";
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

// Refetch the saved case rather than relying on the response body or hub echo.
export async function recordVitals(caseId: string, request: RecordVitalsRequest): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/cases/${caseId}/vitals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorizationHeader() },
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
    throw new Error("Failed to record vitals.");
  }
}

export async function recordPainScore(caseId: string, request: PainScoreRequest): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/cases/${caseId}/pain-scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorizationHeader() },
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
    throw new Error("Failed to record pain score.");
  }
}

// Tick a checklist task done, or untick it (build plan 4.4b). A 401 or 403 is
// a refused session; any other failure is an error the panel shows and
// recovers from by reloading.
export function completeTask(caseId: string, taskId: string): Promise<void> {
  return postTaskAction(caseId, taskId, "complete");
}

export function reopenTask(caseId: string, taskId: string): Promise<void> {
  return postTaskAction(caseId, taskId, "reopen");
}

async function postTaskAction(caseId: string, taskId: string, action: "complete" | "reopen"): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/cases/${caseId}/tasks/${taskId}/${action}`, {
    method: "POST",
    headers: authorizationHeader()
  });

  throwIfRefused(response);

  if (!response.ok) {
    throw new Error("Failed to update the task.");
  }
}

// Adds a task, blocker or due item to a case (build plan 4.4c). A 400 brings
// the first message for each refused field; 404 and 409 mean the case is gone.
// The panel reloads the case afterwards, so the created task is not returned.
export async function createTask(caseId: string, request: CaseTaskRequest): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/cases/${caseId}/tasks`, {
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
    throw new Error("Failed to add the task.");
  }
}
