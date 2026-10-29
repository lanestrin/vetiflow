import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, FormRejectedError } from "../../services/apiErrors";
import { triageCase } from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { AcuityLevel } from "../../types/EmergencyCaseListItem";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import styles from "./TriageDialog.module.scss";

type TriageField = "priority" | "notes";

interface TriageDialogProps {
  detail: CaseDetail;
  onClose: () => void;
  // The toast to show; the caller reloads the board.
  onSaved: (message: string) => void;
}

const priorities: { value: AcuityLevel; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "urgent", label: "Urgent" },
  { value: "stable", label: "Stable" }
];

function priorityLabel(priority: AcuityLevel): string {
  return priorities.find((option) => option.value === priority)?.label ?? priority;
}

// The API names fields in PascalCase ("Notes").
function toFieldErrors(apiErrors: Record<string, string>): Partial<Record<TriageField, string>> {
  const errors: Partial<Record<TriageField, string>> = {};
  for (const [key, message] of Object.entries(apiErrors)) {
    const field = (["priority", "notes"] as const).find((name) => name === key.replace(/^\$\./, "").toLowerCase());
    if (field) {
      errors[field] = message;
    }
  }
  return errors;
}

// Complete triage on an incoming case, or re-triage a later one (build plan
// 4.2b), in a native modal dialog like the intake form: it opens when
// mounted, keeps focus inside, closes on Escape or the backdrop and returns
// focus to the button that opened it. Nothing typed is lost on an error.
export function TriageDialog({ detail, onClose, onSaved }: TriageDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);
  const leaveWhenRefused = useLeaveWhenRefused();
  // Fixed when opened, so a reload while it is open doesn't change the task.
  const [isCompleting] = useState(detail.stage === "incoming");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TriageField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    firstRadioRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const priority = data.get("priority") as AcuityLevel | null;
    const notes = String(data.get("notes") ?? "").trim() || null;

    setFormError(null);
    if (!priority) {
      setFieldErrors({ priority: "Choose a priority." });
      firstRadioRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    try {
      await triageCase(detail.id, { priority, notes });
      dialogRef.current?.close();
      onSaved(isCompleting
        ? `${detail.patient.name} triage completed`
        : `${detail.patient.name} re-triaged · ${priorityLabel(priority)}`);
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
        setFormError("Unable to save triage. Try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const titleId = `${id}-title`;
  const errorId = (field: TriageField) => `${id}-${field}-error`;
  const title = isCompleting ? "Complete triage" : "Re-triage";

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
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <p className={styles.tiny}>{detail.patient.name} · Case {detail.caseNumber}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        <div className={styles.body}>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <fieldset
            className={styles.priority}
            aria-invalid={fieldErrors.priority ? true : undefined}
            aria-describedby={fieldErrors.priority ? errorId("priority") : undefined}
          >
            <legend className={styles.label}>Priority</legend>
            <div className={styles.options}>
              {priorities.map((option, index) => (
                <label key={option.value}>
                  <input
                    ref={index === 0 ? firstRadioRef : undefined}
                    type="radio"
                    name="priority"
                    value={option.value}
                    defaultChecked={detail.acuity === option.value}
                  />
                  {" "}{option.label}
                </label>
              ))}
            </div>
            {fieldErrors.priority && <FieldError id={errorId("priority")} text={fieldErrors.priority} />}
          </fieldset>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-notes`}>Triage notes</label>
            <textarea
              id={`${id}-notes`}
              name="notes"
              maxLength={2000}
              placeholder="Findings that support the priority"
              aria-invalid={fieldErrors.notes ? true : undefined}
              aria-describedby={fieldErrors.notes ? errorId("notes") : undefined}
            />
            {fieldErrors.notes && <FieldError id={errorId("notes")} text={fieldErrors.notes} />}
          </div>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving}>
            {isSaving ? "Saving…" : isCompleting ? "Complete triage" : "Save priority"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
