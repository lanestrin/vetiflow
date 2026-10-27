import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { SessionBar } from "../components/auth/SessionBar";
import { PetCareList } from "../components/petParent/PetCareList";
import { SessionEndedError } from "../services/apiErrors";
import { getMyPets } from "../services/petParentApi";
import { clearAccessToken } from "../services/session";
import type { SignedInUser } from "../types/Auth";
import type { PetSummary } from "../types/PetSummary";
import styles from "./PetParentHomePage.module.scss";

interface PetParentHomePageProps {
  user: SignedInUser;
}

type PetsState =
  | { kind: "loading" }
  | { kind: "loaded"; pets: PetSummary[] }
  | { kind: "failed" };

// The demo's pet parent home: their own pets and whether each is in our care.
// RequireExperience lets only pet parents in. Calm wording only.
export function PetParentHomePage({ user }: PetParentHomePageProps) {
  const navigate = useNavigate();
  const [petsState, setPetsState] = useState<PetsState>({ kind: "loading" });

  useEffect(() => {
    let isActive = true;

    getMyPets()
      .then((pets) => {
        if (isActive) {
          setPetsState({ kind: "loaded", pets });
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (error instanceof SessionEndedError) {
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else {
          setPetsState({ kind: "failed" });
        }
      });

    return () => {
      isActive = false;
    };
  }, [navigate]);

  return (
    <main className={styles.page}>
      <title>Welcome · VetiFlow</title>
      <SessionBar user={user} />
      <h1 className={styles.heading}>Welcome back, {user.name}</h1>

      <section className={styles.pets} aria-labelledby="your-pets-heading">
        <h2 id="your-pets-heading" className={styles.subheading}>Your pets</h2>

        {petsState.kind === "loading" && (
          <p className={styles.text} role="status">Loading your pets…</p>
        )}

        {petsState.kind === "failed" && (
          <p className={styles.text} role="status">
            We can't show your pets right now. Refresh the page to try again.
          </p>
        )}

        {petsState.kind === "loaded" && petsState.pets.length === 0 && (
          <p className={styles.text}>
            We don't have any pets linked to your account yet. Ask the hospital team if this looks wrong.
          </p>
        )}

        {petsState.kind === "loaded" && petsState.pets.length > 0 && (
          <PetCareList pets={petsState.pets} />
        )}
      </section>
    </main>
  );
}
