import { AccessDeniedError, SessionEndedError } from "./apiErrors";
import { readAccessToken } from "./session";

// Shared by the staff API calls (the board, from S.18b, and patient records):
// they need a hospital team member's token.
export function authorizationHeader(): Record<string, string> {
  const accessToken = readAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function throwIfRefused(response: Response): void {
  if (response.status === 401) {
    throw new SessionEndedError();
  }

  if (response.status === 403) {
    throw new AccessDeniedError();
  }
}
