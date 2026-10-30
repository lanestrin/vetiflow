import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import type { CaseDetail } from "../../types/CaseDetail";
import styles from "./CaseReviewDrawer.module.scss";

export interface ReviewDrawerProps {
  detail: CaseDetail;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  fallbackRef: RefObject<HTMLHeadingElement | null>;
}

interface CaseReviewDrawerProps extends ReviewDrawerProps {
  title: string;
  children: ReactNode;
}

// Both encounter reviews share the same native-modal and focus lifecycle.
export function CaseReviewDrawer({ detail, title, children, onClose, triggerRef, fallbackRef }: CaseReviewDrawerProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const fallback = fallbackRef.current;
    active.current = true;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      active.current = false;
      if (dialog?.open) dialog.close();
      const target = trigger?.isConnected ? trigger : fallback;
      if (target?.isConnected) target.focus();
    };
  }, [triggerRef, fallbackRef]);

  return (
    <dialog ref={dialogRef} className={styles.drawer} aria-labelledby={`${id}-title`} aria-describedby={`${id}-patient`}
      onClose={event => { if (active.current && !event.currentTarget.open) onClose(); }}
      onCancel={event => { event.preventDefault(); dialogRef.current?.close(); }}>
      <header className={styles.head}>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-patient`}>{detail.patient.name} · Case {detail.caseNumber}</p>
        </div>
        <button ref={closeRef} type="button" className={styles.close} aria-label={`Close ${title}`}
          onClick={() => dialogRef.current?.close()}>Close</button>
      </header>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
