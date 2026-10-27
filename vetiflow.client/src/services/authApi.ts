import type {
  SignedInUser,
  SignInFailure,
  SignInResult
} from "../types/Auth";
import { SessionEndedError } from "./apiErrors";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

const failureCodes: SignInFailure[] = [
  "unknownAccount",
  "wrongPassword",
  "inactiveAccount"
];

// Demo email sign-in (build plan S.17). The password goes only into this
// request body.
export async function signInByEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
  } catch {
    return { ok: false, failure: "unavailable" };
  }

  if (response.ok) {
    const token: unknown = await response.json();
    return { ok: true, accessToken: readAccessToken(token) };
  }

  if (response.status === 401) {
    return { ok: false, failure: await readFailureCode(response) };
  }

  return { ok: false, failure: "unavailable" };
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

async function readFailureCode(response: Response): Promise<SignInFailure> {
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
