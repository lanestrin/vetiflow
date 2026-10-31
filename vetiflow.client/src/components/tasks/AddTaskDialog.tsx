import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, FormRejectedError } from "../../services/apiErrors";
import { createTask } from "../../services/casesApi";
import { getCliniciansOnFloor } from "../../services/staffApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { OnFloorClinician } from "../../types/StaffStatus";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useClinicalDraft } from "../forms/useClinicalDraft";
import styles from "./TaskDialog.module.scss";

type TaskField = "description" | "type" | "assignee";

type Clinicians = { kind: "loading" } | { kind: "shown"; list: OnFloorClinician[] } | { kind: "failed" };

interface AddTaskDialogProps {
  detail: CaseDetail;
  caseUnavailable?: boolean;
  onClose: () => void;
  // The toast to show; the caller reloads the board.
  onSaved: (message: string) => void;
}

// The API names fields in PascalCase ("Description", "AssignedToStaffId").
const apiFields: Record<string, TaskField> = {
  description: "description",
  type: "type",
  assignedtostaffid: "assignee"
};

function toFieldErrors(apiErrors: Record<string, string>): Partial<Record<TaskField, string>> {
  const errors: Partial<Record<TaskField, string>> = {};
  for (const [key, message] of Object.entries(apiErrors)) {
    const field = apiFields[key.replace(/^\$\./, "").toLowerCase()];
    if (field) {
      errors[field] = message;
    }
  }
  return errors;
}

// Adds a task or blocker to the case, optionally with a clinician on the
// floor (build plan 4.4c). A native modal dialog like the triage dialog: it
// opens when mounted, closes on Escape or the backdrop and returns focus to
// ＋ Add task. Nothing typed is lost on an error.
export function AddTaskDialog({ detail, caseUnavailable = false, onClose, onSaved }: AddTaskDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useClinicalDraft(dialogRef, formRef);
  const [target] = useState(detail);
  const [isGone, setIsGone] = useState(false);
  const unavailable = caseUnavailable || isGone || detail.dischargedAt !== null;
  const descriptionRef = useRef<HTMLInputElement>(null);
  const leaveWhenRefused = useLeaveWhenRefused();
  const [clinicians, setClinicians] = useState<Clinicians>({ kind: "loading" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TaskField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    descriptionRef.current?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadClinicians() {
      try {
        const list = await getCliniciansOnFloor();
        if (isActive) {
          setClinicians({ kind: "shown", list });
        }
      } catch (loadError) {
        if (isActive && !leaveWhenRefused(loadError)) {
          setClinicians({ kind: "failed" });
        }
      }
    }

    void loadClinicians();

    return () => {
      isActive = false;
    };
  }, [leaveWhenRefused]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.isSaving() || !draft.isActive() || unavailable) return;
    const data = new FormData(event.currentTarget);
    const description = String(data.get("description") ?? "").trim();
    const type = data.get("type") === "blocker" ? "blocker" : "task";
    const assignee = String(data.get("assignee") ?? "");

    setFormError(null);
    if (!description) {
      setFieldErrors({ description: "Enter a task." });
      descriptionRef.current?.focus();
      return;
    }

    setFieldErrors({});
    if (!draft.startSaving()) return;
    setIsSaving(true);
    try {
      await createTask(target.id, { type, description, ...(assignee ? { assignedToStaffId: assignee } : {}) });
      if (!draft.isActive()) return;
      draft.saved();
      dialogRef.current?.close();
      onSaved(type === "blocker" ? "Blocker added" : "Task added");
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
        setFormError("Unable to save. Try again.");
      }
    } finally {
      draft.finishSaving();
      if (draft.isActive()) setIsSaving(false);
    }
  }

  const titleId = `${id}-title`;
  const errorId = (field: TaskField) => `${id}-${field}-error`;
  const describedBy = (field: TaskField) => (fieldErrors[field] ? errorId(field) : undefined);

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
          <p className={styles.eyebrow}>Next actions</p>
          <h2 id={titleId} className={styles.title}>Add task</h2>
          <p className={styles.tiny}>{target.patient.name} · Case {target.caseNumber}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close add task"
          disabled={isSaving} onClick={draft.dismiss}
        >
          ×
        </button>
      </div>

      <form ref={formRef} {...draft.formProps} onSubmit={submit} noValidate aria-labelledby={titleId} aria-busy={isSaving}>
        <div className={styles.body}>
          {(formError || unavailable) && <p className={styles.formError} role="alert">{formError ?? "This case is no longer available for changes."}</p>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-description`}>Task *</label>
            <input
              ref={descriptionRef}
              id={`${id}-description`}
              name="description"
              maxLength={200}
              placeholder="e.g. Review radiographs"
              aria-invalid={fieldErrors.description ? true : undefined}
              aria-describedby={describedBy("description")}
            />
            {fieldErrors.description && <FieldError id={errorId("description")} text={fieldErrors.description} />}
          </div>

          <fieldset
            className={styles.kind}
            aria-invalid={fieldErrors.type ? true : undefined}
            aria-describedby={describedBy("type")}
          >
            <legend className={styles.label}>Kind</legend>
            <div className={styles.options}>
              <label>
                <input disabled={isSaving} type="radio" name="type" value="task" defaultChecked />
                {" "}Task
              </label>
              <label>
                <input disabled={isSaving} type="radio" name="type" value="blocker" />
                {" "}Blocker
              </label>
            </div>
            {fieldErrors.type && <FieldError id={errorId("type")} text={fieldErrors.type} />}
          </fieldset>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-assignee`}>Assign to</label>
            <select
              id={`${id}-assignee`}
              name="assignee"
              defaultValue=""
              aria-invalid={fieldErrors.assignee ? true : undefined}
              aria-describedby={describedBy("assignee") ?? (clinicians.kind === "failed" ? `${id}-assignee-hint` : undefined)}
            >
              <option value="">Unassigned</option>
              {clinicians.kind === "shown" && clinicians.list.map((clinician) => (
                <option key={clinician.id} value={clinician.id}>{clinician.displayName}</option>
              ))}
            </select>
            {clinicians.kind === "failed" && (
              <p id={`${id}-assignee-hint`} className={styles.hint}>
                Couldn't load who's on the floor. You can still add it unassigned.
              </p>
            )}
            {fieldErrors.assignee && <FieldError id={errorId("assignee")} text={fieldErrors.assignee} />}
          </div>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={draft.dismiss}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable}>
            {isSaving ? "Saving…" : "Add task"}
          </button>
        </div>
      </form>
    </dialog>
    {draft.confirmation}
    </>
  );
}
