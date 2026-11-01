import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, ChangeRefusedError, FormRejectedError } from "../../services/apiErrors";
import { addCaseTag } from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { CaseTagTone } from "../../types/CaseTag";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useClinicalDraft } from "../forms/useClinicalDraft";
import styles from "../status/UpdateStatusDialog.module.scss";
import { caseTagMaxTextLength, caseTagTones } from "./caseTagRules";

type TagField = "text" | "tone";

interface CaseTagDialogProps {
  detail: CaseDetail;
  caseUnavailable?: boolean;
  onClose: () => void;
  // The toast to show; the caller reloads the panel and the board.
  onSaved: (message: string) => void;
}

// The API names fields in PascalCase ("Text").
function toFieldErrors(apiErrors: Record<string, string>): Partial<Record<TagField, string>> {
  const errors: Partial<Record<TagField, string>> = {};
  for (const [key, message] of Object.entries(apiErrors)) {
    const field = (["text", "tone"] as const).find((name) => name === key.replace(/^\$\./, "").toLowerCase());
    if (field) {
      errors[field] = message;
    }
  }
  return errors;
}

// Adds a tag to a case (build plan 3.5b), in the same native modal pattern as the
// status dialog. The limits and duplicates are the server's: a refusal shows its
// reason and keeps what was typed.
export function CaseTagDialog({ detail, caseUnavailable = false, onClose, onSaved }: CaseTagDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const draft = useClinicalDraft(dialogRef, formRef);
  const [target] = useState(detail);
  const [isGone, setIsGone] = useState(false);
  const unavailable = caseUnavailable || isGone || detail.dischargedAt !== null;
  const leaveWhenRefused = useLeaveWhenRefused();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TagField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    firstFieldRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.isSaving() || !draft.isActive() || unavailable) return;
    const data = new FormData(event.currentTarget);
    const text = String(data.get("text") ?? "").trim();
    const tone = data.get("tone") as CaseTagTone;

    setFormError(null);
    if (!text) {
      setFieldErrors({ text: "Enter the tag's text." });
      firstFieldRef.current?.focus();
      return;
    }

    setFieldErrors({});
    if (!draft.startSaving()) return;
    setIsSaving(true);
    try {
      await addCaseTag(target.id, { text, tone });
      if (!draft.isActive()) return;
      draft.saved();
      dialogRef.current?.close();
      onSaved("Tag added");
    } catch (error) {
      if (!draft.isActive() || leaveWhenRefused(error)) {
        return;
      }

      if (error instanceof FormRejectedError && Object.keys(toFieldErrors(error.fieldErrors)).length > 0) {
        setFieldErrors(toFieldErrors(error.fieldErrors));
      } else if (error instanceof ChangeRefusedError) {
        setFormError(error.reason);
      } else if (error instanceof CaseGoneError) {
        setIsGone(true);
        setFormError("This case is no longer on the board.");
      } else {
        setFormError("Unable to add the tag. Try again.");
      }
    } finally {
      draft.finishSaving();
      if (draft.isActive()) setIsSaving(false);
    }
  }

  const titleId = `${id}-title`;
  const errorId = (field: TagField) => `${id}-${field}-error`;

  if (draft.exited) return null;

  return (
    <>
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); draft.dismiss(); }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) {
          draft.dismiss();
        }
      }}
    >
      <div className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.title}>Add tag</h2>
          <p className={styles.tiny}>{target.patient.name} · Case {target.caseNumber}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close add tag"
          disabled={isSaving} onClick={draft.dismiss}
        >
          ×
        </button>
      </div>

      <form ref={formRef} {...draft.formProps} onSubmit={submit} noValidate aria-labelledby={titleId} aria-busy={isSaving}>
        <div className={styles.body}>
          {(formError || unavailable) && <p className={styles.formError} role="alert">{formError ?? "This case is no longer available for changes."}</p>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-text`}>Tag text</label>
            <input
              ref={firstFieldRef}
              id={`${id}-text`}
              name="text"
              type="text"
              maxLength={caseTagMaxTextLength}
              placeholder="For example, O2 support"
              disabled={unavailable}
              aria-invalid={fieldErrors.text ? true : undefined}
              aria-describedby={fieldErrors.text ? errorId("text") : undefined}
            />
            {fieldErrors.text && <FieldError id={errorId("text")} text={fieldErrors.text} />}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-tone`}>Tone</label>
            <select
              id={`${id}-tone`}
              name="tone"
              defaultValue="neutral"
              disabled={unavailable}
              aria-invalid={fieldErrors.tone ? true : undefined}
              aria-describedby={fieldErrors.tone ? errorId("tone") : undefined}
            >
              {caseTagTones.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {fieldErrors.tone && <FieldError id={errorId("tone")} text={fieldErrors.tone} />}
          </div>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={draft.dismiss}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable}>
            {isSaving ? "Saving…" : "Add tag"}
          </button>
        </div>
      </form>
    </dialog>
    {draft.confirmation}
    </>
  );
}
