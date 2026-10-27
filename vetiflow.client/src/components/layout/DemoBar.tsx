import styles from "./DemoBar.module.scss";

// Every page says it is a demo with fictional data (project plan section 10).
export function DemoBar() {
  return (
    <p className={styles.bar}>
      <strong>Demo</strong> · fictional data only
    </p>
  );
}
