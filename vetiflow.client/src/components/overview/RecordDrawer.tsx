import { useEffect, useRef, type ReactNode } from "react";
import styles from "./RecordDrawer.module.scss";

interface RecordDrawerProps {
  // The board's close path (3.2f): it may keep the record open for a draft.
  onClose: () => void;
  children: ReactNode;
}

// The patient record at tablet and phone widths (2.27a): a modal drawer over
// the board. Escape and a backdrop press ask the board to close it, as the
// record's own ✕ does; the drawer closes when the board stops rendering it.
export function RecordDrawer({ onClose, children }: RecordDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    dialog?.showModal();
    // On the drawer itself: the record inside it is still loading.
    dialog?.focus();
    // Only the drawer scrolls while it is open.
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.drawer} aria-label="Patient record" tabIndex={-1}
      // React passes a dialog's cancel on to the dialogs around it; Escape in
      // a dialog opened from the record closes only that dialog.
      onCancel={event => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
      // The record fills the drawer, so a press on the dialog itself is on its backdrop.
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      {children}
    </dialog>
  );
}
