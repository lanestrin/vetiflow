import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, FormRejectedError } from "../../services/apiErrors";
import { createTask } from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useNow } from "../board/useNow";
import { defaultDueTime, dueAtFromTime, dueLabel, timeLabel } from "../overview/overviewFormat";
import styles from "./TaskDialog.module.scss";

export type DueItemType = "reassessment" | "clientUpdate";

type DueField = "dueAt" | "note";

interface DueItemDialogProps {
  detail: CaseDetail;
  type: DueItemType;
  onClose: () => void;
  // The toast to show; the caller reloads the board.
  onSaved: (message: string) => void;
}

const wording: Record<DueItemType, { eyebrow: string; title: string; name: string; placeholder: string }> = {
  reassessment: {
    eyebrow: "Next reassessment",
    title: "Set reassessment",
    name: "Reassessment",
    placeholder: "e.g. SpO₂ and respiratory status"
  },
  clientUpdate: {
    eyebrow: "Client update",
    title: "Set client update",
    name: "Client update",
    placeholder: "What the pet parent needs to hear"
  }
};

// The API names fields in PascalCase ("DueAt"); the note is the Description.
const apiFields: Record<string, DueField> = {
  dueat: "dueAt",
  description: "note"
};

function toFieldErrors(apiErrors: Record<string, string>): Partial<Record<DueField, string>> {
  const errors: Partial<Record<DueField, string>> = {};
  for (const [key, message] of Object.entries(apiErrors)) {
    const field = apiFields[key.replace(/^\$\./, "").toLowerCase()];
    if (field) {
      errors[field] = message;
    }
  }
  return errors;
}

// Sets when the next reassessment or client update is due (build plan 4.4c),
// in a native modal dialog like the triage dialog. A time that has passed
// today means tomorrow; the preview beside it says which.
export function DueItemDialog({ detail, type, onClose, onSaved }: DueItemDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const leaveWhenRefused = useLeaveWhenRefused();
  const now = useNow();
  const words = wording[type];
  const [time, setTime] = useState(() => defaultDueTime(new Date()));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DueField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    timeRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = String(data.get("note") ?? "").trim() || words.name;
    // From the clock at the moment of saving, not when the dialog opened.
    const dueAt = dueAtFromTime(time, new Date());

    setFormError(null);
    if (dueAt === null) {
      setFieldErrors({ dueAt: "Enter a due time." });
      timeRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    try {
      await createTask(detail.id, { type, description: note, dueAt });
      dialogRef.current?.close();
      onSaved(`${words.name} due ${timeLabel(dueAt, new Date())}`);
    } catch (error) {
      if (leaveWhenRefused(error)) {
        return;
      }

      if (error instanceof FormRejectedError && Object.keys(toFieldErrors(error.fieldErrors)).length > 0) {
        setFieldErrors(toFieldErrors(error.fieldErrors));
      } else if (error instanceof CaseGoneError) {
        setFormError(error.reason === "discharged"
          ? "This case has been discharged."
          : "This case is no longer on the board.");
      } else {
        setFormError("Unable to save. Try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const titleId = `${id}-title`;
  const previewId = `${id}-preview`;
  const errorId = (field: DueField) => `${id}-${field}-error`;
  const dueAt = dueAtFromTime(time, now);

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
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{words.eyebrow}</p>
          <h2 id={titleId} className={styles.title}>{words.title}</h2>
          <p className={styles.tiny}>{detail.patient.name} · Case {detail.caseNumber}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={`Close ${words.title.toLowerCase()}`}
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        <div className={styles.body}>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-time`}>Due at *</label>
            <div className={styles.timeLine}>
              <input
                ref={timeRef}
                id={`${id}-time`}
                type="time"
                step={300}
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-invalid={fieldErrors.dueAt ? true : undefined}
                aria-describedby={fieldErrors.dueAt ? `${previewId} ${errorId("dueAt")}` : previewId}
              />
              <p id={previewId} className={styles.hint}>{dueAt ? dueLabel(dueAt, now) : "No time set"}</p>
            </div>
            {fieldErrors.dueAt && <FieldError id={errorId("dueAt")} text={fieldErrors.dueAt} />}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-note`}>Note</label>
            <input
              id={`${id}-note`}
              name="note"
              maxLength={200}
              placeholder={words.placeholder}
              aria-invalid={fieldErrors.note ? true : undefined}
              aria-describedby={fieldErrors.note ? errorId("note") : undefined}
            />
            {fieldErrors.note && <FieldError id={errorId("note")} text={fieldErrors.note} />}
          </div>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving}>
            {isSaving ? "Saving…" : words.title}
          </button>
        </div>
      </form>
    </dialog>
  );
}
