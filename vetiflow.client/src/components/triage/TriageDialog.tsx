import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, FormRejectedError } from "../../services/apiErrors";
import { triageCase } from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { AcuityLevel } from "../../types/EmergencyCaseListItem";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useClinicalDraft } from "../forms/useClinicalDraft";
import styles from "./TriageDialog.module.scss";

type TriageField = "priority" | "notes";

interface TriageDialogProps {
  detail: CaseDetail;
  caseUnavailable?: boolean;
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
export function TriageDialog({ detail, caseUnavailable = false, onClose, onSaved }: TriageDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useClinicalDraft(dialogRef, formRef);
  const [target] = useState(detail);
  const [isGone, setIsGone] = useState(false);
  const unavailable = caseUnavailable || isGone || detail.dischargedAt !== null;
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
    if (draft.isSaving() || !draft.isActive() || unavailable) return;
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
    if (!draft.startSaving()) return;
    setIsSaving(true);
    try {
      await triageCase(target.id, { priority, notes });
      if (!draft.isActive()) return;
      draft.saved();
      dialogRef.current?.close();
      onSaved(isCompleting
        ? `${target.patient.name} triage completed`
        : `${target.patient.name} re-triaged · ${priorityLabel(priority)}`);
    } catch (error) {
      if (!draft.isActive() || leaveWhenRefused(error)) {
        return;
      }

      if (error instanceof FormRejectedError && Object.keys(toFieldErrors(error.fieldErrors)).length > 0) {
        setFieldErrors(toFieldErrors(error.fieldErrors));
      } else if (error instanceof CaseGoneError) {
        setIsGone(true);
        setFormError(error.reason === "discharged"
          ? "This case has been discharged."
          : "This case is no longer on the board.");
      } else {
        setFormError("Unable to save triage. Try again.");
      }
    } finally {
      draft.finishSaving();
      if (draft.isActive()) setIsSaving(false);
    }
  }

  const titleId = `${id}-title`;
  const errorId = (field: TriageField) => `${id}-${field}-error`;
  const title = isCompleting ? "Complete triage" : "Re-triage";

  if (draft.exited) return null;

  return (
    <>
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={event => { event.preventDefault(); draft.dismiss(); }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) {
          draft.dismiss();
        }
      }}
    >
      <div className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <p className={styles.tiny}>{target.patient.name} · Case {target.caseNumber}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={`Close ${title.toLowerCase()}`}
          disabled={isSaving} onClick={draft.dismiss}
        >
          ×
        </button>
      </div>

      <form ref={formRef} {...draft.formProps} onSubmit={submit} noValidate aria-labelledby={titleId} aria-busy={isSaving}>
        <div className={styles.body}>
          {(formError || unavailable) && <p className={styles.formError} role="alert">{formError ?? "This case is no longer available for changes."}</p>}
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
                    defaultChecked={target.acuity === option.value}
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
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={draft.dismiss}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable}>
            {isSaving ? "Saving…" : isCompleting ? "Complete triage" : "Save priority"}
          </button>
        </div>
      </form>
    </dialog>
    {draft.confirmation}
    </>
  );
}
