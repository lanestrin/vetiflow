import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, FormRejectedError } from "../../services/apiErrors";
import { createTask } from "../../services/casesApi";
import { getCliniciansOnFloor } from "../../services/staffApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { OnFloorClinician } from "../../types/StaffStatus";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import styles from "./TaskDialog.module.scss";

type TaskField = "description" | "type" | "assignee";

type Clinicians = { kind: "loading" } | { kind: "shown"; list: OnFloorClinician[] } | { kind: "failed" };

interface AddTaskDialogProps {
  detail: CaseDetail;
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
export function AddTaskDialog({ detail, onClose, onSaved }: AddTaskDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    setIsSaving(true);
    try {
      await createTask(detail.id, { type, description, ...(assignee ? { assignedToStaffId: assignee } : {}) });
      dialogRef.current?.close();
      onSaved(type === "blocker" ? "Blocker added" : "Task added");
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
  const errorId = (field: TaskField) => `${id}-${field}-error`;
  const describedBy = (field: TaskField) => (fieldErrors[field] ? errorId(field) : undefined);

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
          <p className={styles.eyebrow}>Next actions</p>
          <h2 id={titleId} className={styles.title}>Add task</h2>
          <p className={styles.tiny}>{detail.patient.name} · Case {detail.caseNumber}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close add task"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        <div className={styles.body}>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
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
                <input type="radio" name="type" value="task" defaultChecked />
                {" "}Task
              </label>
              <label>
                <input type="radio" name="type" value="blocker" />
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
          <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving}>
            {isSaving ? "Saving…" : "Add task"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
