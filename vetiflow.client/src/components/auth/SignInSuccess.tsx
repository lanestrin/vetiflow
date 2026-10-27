import type { Experience, SignedInUser } from "../../types/Auth";
import { experienceLabels } from "./experienceLabels";
import { PrimaryButton } from "./PrimaryButton";
import styles from "./SignInSuccess.module.scss";

interface SignInSuccessProps {
  user: SignedInUser;
  onContinue: () => void;
  onBack: () => void;
}

const welcomeTitles: Record<Experience, string> = {
  teamMember: "Welcome to your care team",
  petParent: "Welcome back"
};

export function SignInSuccess({ user, onContinue, onBack }: SignInSuccessProps) {
  return (
    <section className={styles.success} aria-labelledby="sign-in-success-title">
      <span className={styles.badge} aria-hidden="true">✓</span>
      <h2 id="sign-in-success-title" className={styles.title}>
        {welcomeTitles[user.experience]}
      </h2>
      <p className={styles.copy}>Signed in as {user.name}.</p>

      <PrimaryButton onClick={onContinue}>
        Continue as {experienceLabels[user.experience]}
      </PrimaryButton>
      <button type="button" className={styles.back} onClick={onBack}>
        Back to sign in
      </button>
    </section>
  );
}
