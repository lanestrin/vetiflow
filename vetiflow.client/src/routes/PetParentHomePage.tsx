import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSignedInUser } from "../services/authApi";
import { readAccessToken } from "../services/session";
import type { SignedInUser } from "../types/Auth";
import styles from "./PetParentHomePage.module.scss";

type PageState =
  | { kind: "loading" }
  | { kind: "signedIn"; user: SignedInUser }
  | { kind: "signedOut" };

// The demo's pet parent welcome (S.18a). Their pets come in S.18c; guards in
// S.18b. Calm wording only: no acuity, no clinical terms.
export function PetParentHomePage() {
  const [state, setState] = useState<PageState>(() =>
    readAccessToken() ? { kind: "loading" } : { kind: "signedOut" }
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
      .catch(() => {
        if (isActive) {
          setState({ kind: "signedOut" });
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className={styles.page}>
      <title>Welcome · VetiFlow</title>
      {state.kind === "loading" && <p className={styles.text}>Loading…</p>}

      {state.kind === "signedOut" && (
        <>
          <h1 className={styles.heading}>Sign in to see your pet's updates</h1>
          <p className={styles.text}>
            <Link className={styles.link} to="/sign-in">Go to sign in</Link>
          </p>
        </>
      )}

      {state.kind === "signedIn" && state.user.experience === "petParent" && (
        <>
          <h1 className={styles.heading}>Welcome back, {state.user.name}</h1>
          <p className={styles.text}>Your pet's care updates will appear here.</p>
        </>
      )}

      {state.kind === "signedIn" && state.user.experience === "teamMember" && (
        <>
          <h1 className={styles.heading}>This page is for pet parents</h1>
          <p className={styles.text}>
            <Link className={styles.link} to="/er">Go to the ER board</Link>
          </p>
        </>
      )}
    </main>
  );
}
