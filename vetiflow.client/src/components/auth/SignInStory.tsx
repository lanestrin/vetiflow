import type { ReactNode } from "react";
import logoUrl from "../../assets/sign-in/logo.svg";
import { CareUpdatesIcon, MessageIcon, PeopleIcon } from "./signInIcons";
import styles from "./SignInStory.module.scss";

// The story side of the sign-in landing page (build plan S.20a). Three
// pieces, so the page can place the
// sign-in card between them on narrow screens.

export function SignInBrand() {
  return (
    <header className={styles.brandRow}>
      <p className={styles.brand}>
        <img className={styles.logo} src={logoUrl} alt="" width="42" height="39" />
        VetiFlow
      </p>
      <p className={styles.kicker}>Veterinary care. In sync.</p>
    </header>
  );
}

export function SignInStory() {
  return (
    <section className={styles.story} aria-label="About VetiFlow">
      <p className={styles.eyebrow}>
        <span className={styles.eyebrowDot} aria-hidden="true" />
        Care, connected
      </p>
      <p className={styles.headline}>
        Care moves fast.
        <br />
        <span className={styles.headlineAccent}>Stay in sync.</span>
      </p>
      <p className={styles.lead}>
        A clearer connection between veterinary teams and the people who love their pets.
      </p>
    </section>
  );
}

interface Benefit {
  title: string;
  text: string;
  icon: ReactNode;
  tone: "mint" | "lilac" | "peach";
}

const benefits: Benefit[] = [
  {
    title: "Care updates, all in one place",
    text: "Your hospital team is here when you need them.",
    icon: <CareUpdatesIcon />,
    tone: "mint"
  },
  {
    title: "Less phone tag",
    text: "Secure messaging and real-time updates.",
    icon: <MessageIcon />,
    tone: "lilac"
  },
  {
    title: "A more connected care experience",
    text: "For healthier, happier pets.",
    icon: <PeopleIcon />,
    tone: "peach"
  }
];

export function SignInBenefits() {
  return (
    <ul className={styles.benefits} aria-label="VetiFlow benefits">
      {benefits.map((benefit) => (
        <li key={benefit.title} className={styles.benefit}>
          <span className={`${styles.benefitIcon} ${styles[benefit.tone]}`}>{benefit.icon}</span>
          <span>
            <strong className={styles.benefitTitle}>{benefit.title}</strong>
            <span className={styles.benefitText}>{benefit.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
