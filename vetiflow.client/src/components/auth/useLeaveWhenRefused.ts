import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AccessDeniedError, SessionEndedError } from "../../services/apiErrors";
import { clearAccessToken } from "../../services/session";
import type { SignInRouteState } from "./experienceHome";

// When a staff request is refused, leave the page as the board does: an ended
// session goes to sign-in with a notice, a pet parent to their home. Returns
// whether it left, so the caller handles any other error itself.
export function useLeaveWhenRefused(): (error: unknown) => boolean {
  const navigate = useNavigate();

  return useCallback((error: unknown) => {
    if (error instanceof SessionEndedError) {
      clearAccessToken();
      navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
      return true;
    }

    if (error instanceof AccessDeniedError) {
      navigate("/pet-parent", { replace: true });
      return true;
    }

    return false;
  }, [navigate]);
}
