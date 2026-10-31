import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AccessDeniedError, SessionEndedError } from "../../services/apiErrors";
import { clearAccessToken } from "../../services/session";
import type { SignInRouteState } from "./experienceHome";
import { useClinicalDraftNavigation } from "../forms/clinicalDraftContext";

// When a staff request is refused, leave the page as the board does: an ended
// session goes to sign-in with a notice, a pet parent to their home. Returns
// whether it left, so the caller handles any other error itself.
export function useLeaveWhenRefused(): (error: unknown) => boolean {
  const navigate = useNavigate();
  const drafts = useClinicalDraftNavigation();

  return useCallback((error: unknown) => {
    if (error instanceof SessionEndedError) {
      drafts.forceExit();
      clearAccessToken();
      navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
      return true;
    }

    if (error instanceof AccessDeniedError) {
      drafts.forceExit();
      navigate("/pet-parent", { replace: true });
      return true;
    }

    return false;
  }, [navigate, drafts]);
}
