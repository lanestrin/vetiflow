import type { SignInFailure } from "../../types/Auth";

// The demo's wording for each failure (project plan section 10). The API sends
// codes only; what people read lives here, for both sign-in methods.
export const failureMessages: Record<SignInFailure, string> = {
  unknownAccount: "We couldn't match that demo account. Try one of the sample emails below.",
  wrongPassword: "Use welcome1 for this demo account.",
  inactiveAccount: "This demo account is turned off.",
  unknownPhone: "We couldn't match that demo phone. Try one of the sample numbers below.",
  wrongCode: "Use 123456 for this demo.",
  phoneSignInOff: "Phone sign-in is turned off for this demo. Use email instead.",
  unavailable: "Sign-in isn't available right now. Try again in a moment."
};
