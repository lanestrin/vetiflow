import { Navigate } from "react-router-dom";
import { experienceHome, type SignInRouteState } from "./experienceHome";
import { SessionCheckMessage } from "./SessionCheckMessage";
import { useSession } from "./useSession";

// "/" opens the signed-in person's own home, or sign-in.
export function HomeRedirect() {
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
      return <Navigate to={experienceHome[session.user.experience]} replace />;
  }
}
