import type {
  Experience,
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

const experiences: Experience[] = ["teamMember", "petParent"];

// Every sign-in call takes an optional signal, so a form can cancel its
// request when the person switches to the other sign-in method.

// Demo email sign-in (build plan S.17). The password goes only into this
// request body.
export function signInByEmail(email: string, password: string, signal?: AbortSignal): Promise<SignInResult> {
  return requestToken("/api/auth/email", { email, password }, signal);
}

// Demo phone sign-in, step one (S.19): is this a demo account's number? No
// text is sent.
export async function startPhoneSignIn(phoneNumber: string, signal?: AbortSignal): Promise<PhoneStartResult> {
  const response = await postJson("/api/auth/phone/start", { phoneNumber }, signal);

  if (response === null) {
    return { ok: false, failure: "unavailable" };
  }

  return response.ok ? { ok: true } : { ok: false, failure: await readFailure(response) };
}

// Demo phone sign-in, step two: the fixed demo code for a token.
export function verifyPhoneSignIn(
  phoneNumber: string,
  code: string,
  signal?: AbortSignal
): Promise<SignInResult> {
  return requestToken("/api/auth/phone/verify", { phoneNumber, code }, signal);
}

// Both sign-in methods end here: keep the token for this tab and find out
// who signed in. A failure (or a cancel) leaves no half-signed-in session
// behind.
export async function finishSignIn(accessToken: string, signal?: AbortSignal): Promise<SignedInUser> {
  saveAccessToken(accessToken);

  try {
    return await getSignedInUser(accessToken, signal);
  } catch (error) {
    clearAccessToken();
    throw error;
  }
}

export async function getSignedInUser(accessToken: string, signal?: AbortSignal): Promise<SignedInUser> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal
  });

  if (response.status === 401) {
    throw new SessionEndedError();
  }

  if (!response.ok) {
    throw new Error("Failed to load the signed-in user.");
  }

  return readSignedInUser(await response.json());
}

async function requestToken(path: string, body: unknown, signal?: AbortSignal): Promise<SignInResult> {
  const response = await postJson(path, body, signal);

  if (response === null) {
    return { ok: false, failure: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, failure: await readFailure(response) };
  }

  // A success that isn't JSON or has no token is treated like no answer.
  try {
    const token: unknown = await response.json();
    const accessToken = readAccessToken(token);
    return accessToken === null ? { ok: false, failure: "unavailable" } : { ok: true, accessToken };
  } catch {
    return { ok: false, failure: "unavailable" };
  }
}

// Null when the request never reached the API (network error or cancelled).
async function postJson(path: string, body: unknown, signal?: AbortSignal): Promise<Response | null> {
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
  } catch {
    return null;
  }
}

function readAccessToken(token: unknown): string | null {
  if (
    typeof token === "object" &&
    token !== null &&
    "accessToken" in token &&
    typeof token.accessToken === "string" &&
    token.accessToken !== ""
  ) {
    return token.accessToken;
  }

  return null;
}

function readSignedInUser(user: unknown): SignedInUser {
  if (
    typeof user === "object" &&
    user !== null &&
    "name" in user &&
    typeof user.name === "string" &&
    "experience" in user &&
    experiences.some((experience) => experience === user.experience)
  ) {
    return { name: user.name, experience: user.experience as Experience };
  }

  throw new Error("The signed-in user response was not understood.");
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
