import { SessionBar } from "../components/auth/SessionBar";
import type { SignedInUser } from "../types/Auth";
import styles from "./PetParentHomePage.module.scss";

interface PetParentHomePageProps {
  user: SignedInUser;
}

// The demo's pet parent welcome. RequireExperience lets only pet parents in;
// their pets come in S.18c. Calm wording only: no acuity, no clinical terms.
export function PetParentHomePage({ user }: PetParentHomePageProps) {
  return (
    <main className={styles.page}>
      <title>Welcome · VetiFlow</title>
      <SessionBar user={user} />
      <h1 className={styles.heading}>Welcome back, {user.name}</h1>
      <p className={styles.text}>Your pet's care updates will appear here.</p>
    </main>
  );
}
