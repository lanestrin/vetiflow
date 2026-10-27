import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Experience, SignedInUser } from "../../types/Auth";
import { experienceHome, type SignInRouteState } from "./experienceHome";
import { SessionCheckMessage } from "./SessionCheckMessage";
import { useSession } from "./useSession";

interface RequireExperienceProps {
  experience: Experience;
  children: (user: SignedInUser) => ReactNode;
}

// Sends each person to the experience their account belongs to. It shapes the
// screens only; the API's 401 and 403 are the real check.
export function RequireExperience({ experience, children }: RequireExperienceProps) {
  const session = useSession();

  switch (session.kind) {
    case "checking":
    case "unavailable":
      return <SessionCheckMessage unavailable={session.kind === "unavailable"} />;
    case "signedOut":
      return <Navigate to="/sign-in" replace />;
    case "ended":
      return <Navigate to="/sign-in" replace state={{ sessionEnded: true } satisfies SignInRouteState} />;
    case "signedIn":
      return session.user.experience === experience
        ? children(session.user)
        : <Navigate to={experienceHome[session.user.experience]} replace />;
  }
}
