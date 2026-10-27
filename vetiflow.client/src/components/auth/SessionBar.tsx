import { useNavigate } from "react-router-dom";
import { clearAccessToken } from "../../services/session";
import type { SignedInUser } from "../../types/Auth";
import styles from "./SessionBar.module.scss";

interface SessionBarProps {
  user: SignedInUser;
}

// Who is signed in, and the way out. Signing out forgets this tab's token, so
// the guards send the back button to sign-in.
export function SessionBar({ user }: SessionBarProps) {
  const navigate = useNavigate();

  function signOut() {
    clearAccessToken();
    navigate("/sign-in", { replace: true });
  }

  return (
    <div className={styles.bar}>
      <p className={styles.who}>
        Signed in as <strong>{user.name}</strong> (demo)
      </p>
      <button type="button" className={styles.signOut} onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
