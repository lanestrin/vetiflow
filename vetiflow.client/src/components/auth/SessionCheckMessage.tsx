import styles from "./SessionCheckMessage.module.scss";

interface SessionCheckMessageProps {
  unavailable: boolean;
}

// Shown while a page asks who is signed in, or when it couldn't find out.
export function SessionCheckMessage({ unavailable }: SessionCheckMessageProps) {
  return (
    <main className={styles.page}>
      <p className={styles.text} role="status">
        {unavailable
          ? "We can't check your sign-in right now. Refresh the page to try again."
          : "Checking your session…"}
      </p>
    </main>
  );
}
