import styles from "./SignInBrandPanel.module.scss";

// The sign-in page's story side, from the login mockup. Decorative marks are
// hidden from screen readers; the words are read.
export function SignInBrandPanel() {
  return (
    <section className={styles.panel} aria-label="About VetiFlow">
      <p className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">+</span>
        VetiFlow
      </p>

      <div className={styles.story}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden="true" />
          Care, connected
        </p>
        <p className={styles.headline}>
          Care moves fast.
          <br />
          Stay in sync.
        </p>
        <p className={styles.lead}>
          A clearer connection between veterinary teams and the people who love their pets.
        </p>

        <div className={styles.careCard}>
          <span className={styles.paw} aria-hidden="true">🐾</span>
          <span>
            <strong className={styles.careTitle}>Care updates, all in one place</strong>
            <span className={styles.careText}>Your hospital team is here when you need them.</span>
          </span>
        </div>
      </div>

      <p className={styles.footer}>Thoughtful care. Clear communication.</p>
    </section>
  );
}
