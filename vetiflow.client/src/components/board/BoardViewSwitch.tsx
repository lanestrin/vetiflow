import styles from "./BoardViewSwitch.module.scss";

// The board's view switch (prototype). My patients is shown but disabled: its
// workspace is not built yet (build plan M3b).
export function BoardViewSwitch() {
  return (
    <div className={styles.switch}>
      <div className={styles.tabs} role="tablist" aria-label="Dashboard view">
        <button type="button" role="tab" aria-selected="true" className={styles.tabSelected}>
          ER board
        </button>
        <button type="button" role="tab" aria-selected="false" disabled title="Coming soon" className={styles.tab}>
          My patients
        </button>
      </div>
      <p className={styles.hint}>Shared patient record · role-focused workspace</p>
    </div>
  );
}
