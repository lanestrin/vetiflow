import { useEffect, useState } from "react";
import { SessionEndedError } from "../../services/apiErrors";
import { getSignedInUser } from "../../services/authApi";
import { clearAccessToken, readAccessToken } from "../../services/session";
import type { SignedInUser } from "../../types/Auth";
import { useClinicalDraftNavigation } from "../forms/clinicalDraftContext";

export type SessionState =
  | { kind: "checking" }
  | { kind: "signedOut" }
  // The saved token was refused: it expired or is no longer valid.
  | { kind: "ended" }
  // The API could not answer; the token may still be fine.
  | { kind: "unavailable" }
  | { kind: "signedIn"; user: SignedInUser };

// Who is signed in in this tab, asked once when the page opens.
export function useSession(): SessionState {
  const drafts = useClinicalDraftNavigation();
  const [state, setState] = useState<SessionState>(() =>
    readAccessToken() ? { kind: "checking" } : { kind: "signedOut" }
  );

  useEffect(() => {
    const accessToken = readAccessToken();

    if (!accessToken) {
      return;
    }

    let isActive = true;

    getSignedInUser(accessToken)
      .then((user) => {
        if (isActive) {
          setState({ kind: "signedIn", user });
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (error instanceof SessionEndedError) {
          drafts.forceExit();
          clearAccessToken();
          setState({ kind: "ended" });
        } else {
          setState({ kind: "unavailable" });
        }
      });

    return () => {
      isActive = false;
    };
  }, [drafts]);

  return state;
}
