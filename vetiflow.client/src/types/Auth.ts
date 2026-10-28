// Which experience an account signs in to (the API's AccountKind).
export type Experience = "teamMember" | "petParent";

export interface SignedInUser {
  name: string;
  experience: Experience;
  // What the top bar's profile shows: "Dr. Jordan Reed" and "JR" (2.10a).
  displayName: string;
  initials: string;
}

// Why a sign-in step failed: the API's codes, plus "unavailable" when the API
// could not answer (network error or a server error).
export type SignInFailure =
  | "unknownAccount"
  | "wrongPassword"
  | "inactiveAccount"
  | "unknownPhone"
  | "wrongCode"
  | "phoneSignInOff"
  | "unavailable";

export type SignInResult =
  | { ok: true; accessToken: string }
  | { ok: false; failure: SignInFailure };
