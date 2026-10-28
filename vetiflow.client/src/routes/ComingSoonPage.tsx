import { Link } from "react-router-dom";
import styles from "./ComingSoonPage.module.scss";

interface ComingSoonPageProps {
  name: string;
}

// A rail destination that isn't built yet (Overview, Team, Reports,
// Settings). Calm, and points to what works today.
export function ComingSoonPage({ name }: ComingSoonPageProps) {
  return (
    <main className={styles.page}>
      <title>{`${name} · VetiFlow`}</title>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Coming soon</p>
        <h1 className={styles.title}>{name}</h1>
        <p className={styles.text}>
          This page is on its way. For now, the ER board and Patients are ready to use.
        </p>
        <div className={styles.links}>
          <Link className={styles.primary} to="/er">Open the ER board</Link>
          <Link className={styles.secondary} to="/records">Search patients</Link>
        </div>
      </div>
    </main>
  );
}
