import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, FormRejectedError } from "../../services/apiErrors";
import { recordPainScore } from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import styles from "./RecordPainScoreDialog.module.scss";

type Field = "score" | "notes";
const scores = Array.from({ length: 11 }, (_, score) => score);

interface RecordPainScoreDialogProps {
  detail: CaseDetail;
  onClose: () => void;
  onSaved: () => void;
  onUnavailable: () => void;
}

export function RecordPainScoreDialog({ detail, onClose, onSaved, onUnavailable }: RecordPainScoreDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scoreRef = useRef<HTMLSelectElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const active = useRef(false);
  const saving = useRef(false);
  const leaveWhenRefused = useLeaveWhenRefused();
  const [target] = useState({ id: detail.id, name: detail.patient.name, number: detail.caseNumber });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGone, setIsGone] = useState(false);
  const unavailable = isGone || detail.dischargedAt !== null;

  useEffect(() => {
    active.current = true;
    dialogRef.current?.showModal();
    scoreRef.current?.focus();
    return () => { active.current = false; };
  }, []);

  // API validation arrives while inputs are disabled. Focus after they re-enable.
  useEffect(() => {
    if (!isSaving) {
      if (errors.score) scoreRef.current?.focus();
      else if (errors.notes) notesRef.current?.focus();
    }
  }, [errors, isSaving]);

  function dismiss() {
    if (!saving.current) dialogRef.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || unavailable) return;
    const data = new FormData(event.currentTarget);
    const text = String(data.get("score") ?? "").trim();
    const score = Number(text);
    const notes = String(data.get("notes") ?? "").trim();
    const invalid: Partial<Record<Field, string>> = {};
    if (text === "" || !Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > 10) {
      invalid.score = "Choose a whole-number score from 0 to 10.";
    }
    if (notes.length > 500) invalid.notes = "Use 500 characters or fewer.";
    setErrors(invalid);
    setFormError(null);
    if (invalid.score || invalid.notes) {
      return;
    }

    saving.current = true;
    setIsSaving(true);
    try {
      await recordPainScore(target.id, { score, ...(notes ? { notes } : {}) });
      if (!active.current) return;
      dialogRef.current?.close();
      onSaved();
    } catch (error) {
      if (!active.current || leaveWhenRefused(error)) return;
      if (error instanceof CaseGoneError) {
        setIsGone(true);
        setFormError(error.reason === "discharged" ? "This case has been discharged." : "This case is no longer on the board.");
        onUnavailable();
      } else if (error instanceof FormRejectedError) {
        const mapped: Partial<Record<Field, string>> = {};
        for (const [key, message] of Object.entries(error.fieldErrors)) {
          const field = key.replace(/^\$\./, "").toLowerCase();
          if (field === "score" || field === "notes") mapped[field] = message;
        }
        setErrors(mapped);
        setFormError(Object.keys(mapped).length ? null : "Unable to save pain score. Try again.");
      } else {
        setFormError("Unable to save pain score. Try again.");
      }
    } finally {
      saving.current = false;
      if (active.current) setIsSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`}
      onClose={onClose}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <header className={styles.head}>
        <div>
          <h2 id={`${id}-title`} className={styles.title}>Record pain score</h2>
          <p className={styles.meta}>{target.name} · Case {target.number}</p>
        </div>
        <button type="button" className={styles.close} aria-label="Close pain score form" disabled={isSaving} onClick={dismiss}>×</button>
      </header>
      <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} aria-busy={isSaving}>
        <div className={styles.body}>
          {(formError || detail.dischargedAt !== null) && <p className={styles.formError} role="alert">
            {formError ?? "This case has been discharged."}
          </p>}
          <div className={styles.field}>
            <label htmlFor={`${id}-score`}>Pain score (0 to 10)</label>
            <select ref={scoreRef} id={`${id}-score`} name="score" defaultValue="" required disabled={isSaving}
              aria-invalid={errors.score ? true : undefined}
              aria-describedby={errors.score ? `${id}-score-error` : `${id}-hint`}>
              <option value="">Choose score</option>
              {scores.map(score => <option key={score} value={score}>{score}</option>)}
            </select>
            {errors.score && <FieldError id={`${id}-score-error`} text={errors.score} />}
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-notes`}>Notes (optional)</label>
            <textarea ref={notesRef} id={`${id}-notes`} name="notes" rows={3} maxLength={500} disabled={isSaving}
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={errors.notes ? `${id}-notes-error` : undefined} />
            {errors.notes && <FieldError id={`${id}-notes-error`} text={errors.notes} />}
          </div>
          <p id={`${id}-hint`} className={styles.hint}>Use the clinic's approved species-specific scale.</p>
        </div>
        <footer className={styles.foot}>
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={dismiss}>Cancel</button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable}>{isSaving ? "Saving..." : "Save pain score"}</button>
        </footer>
      </form>
    </dialog>
  );
}
