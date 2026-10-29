import { useState } from "react";
import { DemoNoticeDialog, type EmergencyAction } from "./DemoNoticeDialog";
import { MapPinIcon, PhoneIcon } from "./signInIcons";
import styles from "./EmergencyBar.module.scss";

// "Need emergency care?" across the foot of the sign-in page (build plan
// S.20b), from the landing design's desktop preview. There is
// no real hospital yet, so both actions are buttons that open a demo notice;
// nothing here dials a number or links to a map.
export function EmergencyBar() {
  const [action, setAction] = useState<EmergencyAction | null>(null);

  return (
    <aside className={styles.bar} aria-label="Emergency veterinary care">
      <div className={styles.info}>
        <span className={styles.badge}>
          <PhoneIcon />
        </span>
        <div className={styles.copy}>
          <h2 className={styles.heading}>Need emergency care?</h2>
          <p className={styles.text}>For life-threatening emergencies, call your hospital directly.</p>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.call} onClick={() => setAction("call")}>
          <PhoneIcon />
          Call Now
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={styles.directions} onClick={() => setAction("directions")}>
          <MapPinIcon />
          View Directions
        </button>
      </div>

      <DemoNoticeDialog action={action} onClose={() => setAction(null)} />
    </aside>
  );
}
