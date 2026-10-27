import type {
  PhoneStartResult,
  SignedInUser,
  SignInFailure,
  SignInResult
} from "../types/Auth";
import { SessionEndedError } from "./apiErrors";
import { clearAccessToken, saveAccessToken } from "./session";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

const failureCodes: SignInFailure[] = [
  "unknownAccount",
  "wrongPassword",
  "inactiveAccount",
  "unknownPhone",
  "wrongCode",
  "phoneSignInOff"
];

// Demo email sign-in (build plan S.17). The password goes only into this
// request body.
export function signInByEmail(email: string, password: string): Promise<SignInResult> {
  return requestToken("/api/auth/email", { email, password });
}

// Demo phone sign-in, step one (S.19): is this a demo account's number? No
// text is sent.
export async function startPhoneSignIn(phoneNumber: string): Promise<PhoneStartResult> {
  const response = await postJson("/api/auth/phone/start", { phoneNumber });

  if (response === null) {
    return { ok: false, failure: "unavailable" };
  }

  return response.ok ? { ok: true } : { ok: false, failure: await readFailure(response) };
}

// Demo phone sign-in, step two: the fixed demo code for a token.
export function verifyPhoneSignIn(phoneNumber: string, code: string): Promise<SignInResult> {
  return requestToken("/api/auth/phone/verify", { phoneNumber, code });
}

// Both sign-in methods end here: keep the token for this tab and find out
// who signed in. A failure leaves no half-signed-in session behind.
export async function finishSignIn(accessToken: string): Promise<SignedInUser> {
  saveAccessToken(accessToken);

  try {
    return await getSignedInUser(accessToken);
  } catch (error) {
    clearAccessToken();
    throw error;
  }
}

export async function getSignedInUser(accessToken: string): Promise<SignedInUser> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401) {
    throw new SessionEndedError();
  }

  if (!response.ok) {
    throw new Error("Failed to load the signed-in user.");
  }

  return response.json();
}

async function requestToken(path: string, body: unknown): Promise<SignInResult> {
  const response = await postJson(path, body);

  if (response === null) {
    return { ok: false, failure: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, failure: await readFailure(response) };
  }

  const token: unknown = await response.json();
  return { ok: true, accessToken: readAccessToken(token) };
}

// Null when the request never reached the API (network error).
async function postJson(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    return null;
  }
}

function readAccessToken(token: unknown): string {
  if (
    typeof token === "object" &&
    token !== null &&
    "accessToken" in token &&
    typeof token.accessToken === "string"
  ) {
    return token.accessToken;
  }

  throw new Error("The sign-in response had no access token.");
}

// The API's failure code (401 and 403 carry one); anything else is "unavailable".
async function readFailure(response: Response): Promise<SignInFailure> {
  if (response.status !== 401 && response.status !== 403) {
    return "unavailable";
  }

  try {
    const problem: unknown = await response.json();
    const code =
      typeof problem === "object" && problem !== null && "code" in problem
        ? problem.code
        : undefined;

    return failureCodes.find((failure) => failure === code) ?? "unavailable";
  } catch {
    return "unavailable";
  }
}
