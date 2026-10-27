import { useEffect, useId, useRef } from "react";
import styles from "./DemoNoticeDialog.module.scss";

export type EmergencyAction = "call" | "directions";

interface DemoNoticeDialogProps {
  // Which button opened the notice; null keeps it closed.
  action: EmergencyAction | null;
  onClose: () => void;
}

const cannot: Record<EmergencyAction, string> = {
  call: "Call Now can't dial a number",
  directions: "View Directions can't open a map"
};

// The emergency bar's notice (build plan S.20b). The demo has no real
// hospital, so it never dials or opens a map; it says so and points to a local
// emergency vet. A native modal dialog keeps focus inside, closes on Escape
// and returns focus to the button that opened it.
export function DemoNoticeDialog({ action, onClose }: DemoNoticeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (action && !dialog.open) {
      dialog.showModal();
    } else if (!action && dialog.open) {
      dialog.close();
    }
  }, [action]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) {
          event.currentTarget.close();
        }
      }}
    >
      <div className={styles.inner}>
        <h2 id={titleId} className={styles.title}>Demo: no hospital is set up</h2>
        {action && (
          <p className={styles.text}>
            This demo isn't connected to a real hospital, so {cannot[action]}. If your pet needs
            care right now, call your local emergency vet.
          </p>
        )}
        <button type="button" className={styles.ok} onClick={() => dialogRef.current?.close()}>
          OK
        </button>
      </div>
    </dialog>
  );
}
