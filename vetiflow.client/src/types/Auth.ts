// Which experience an account signs in to (the API's AccountKind).
export type Experience = "teamMember" | "petParent";

export interface SignedInUser {
  name: string;
  experience: Experience;
}

// Why an email sign-in failed: the API's codes, plus "unavailable" when the
// API could not answer (network error or a server error).
export type SignInFailure =
  | "unknownAccount"
  | "wrongPassword"
  | "inactiveAccount"
  | "unavailable";

export type SignInResult =
  | { ok: true; accessToken: string }
  | { ok: false; failure: SignInFailure };
