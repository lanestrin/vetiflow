import { useEffect, useId, useRef } from "react";
import styles from "./DiscardChangesDialog.module.scss";

export function DiscardChangesDialog({ onAnswer }: { onAnswer: (discard: boolean) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    keep.current?.focus();
  }, []);
  function answer(discard: boolean) {
    dialog.current?.close();
    onAnswer(discard);
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); answer(false); }}>
    <h2 id={`${id}-title`}>Discard unsaved changes?</h2>
    <p id={`${id}-description`}>Your changes have not been saved.</p>
    <div className={styles.actions}>
      <button ref={keep} type="button" onClick={() => answer(false)}>Keep editing</button>
      <button type="button" onClick={() => answer(true)}>Discard changes</button>
    </div>
  </dialog>;
}
