import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FormRejectedError, SessionEndedError } from "../../services/apiErrors";
import { createIntake } from "../../services/casesApi";
import type { CaseIntakeRequest, CaseIntakeResult, IntakeField, TreatmentAuthorization } from "../../types/CaseIntake";
import type { AcuityLevel } from "../../types/EmergencyCaseListItem";
import { FieldError } from "../auth/FormMessages";
import styles from "./IntakeDialog.module.scss";

interface IntakeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CaseIntakeResult, petName: string) => void;
}

type FieldErrors = Partial<Record<IntakeField, string>>;

const requiredFields: [IntakeField, string][] = [
  ["petName", "Enter the patient's name."],
  ["species", "Choose the species."],
  ["ownerName", "Enter the pet parent's name."],
  ["ownerPhone", "Enter a phone number."],
  ["chiefComplaint", "Enter the chief complaint."],
  ["priority", "Choose an initial priority."]
];

const fieldOrder: IntakeField[] = [
  "petName", "species", "breed", "age", "ownerName", "ownerPhone", "chiefComplaint",
  "priority", "triageNotes", "allergies", "medications", "treatmentAuthorization", "referringClinic"
];

function readRequest(form: HTMLFormElement): CaseIntakeRequest {
  const data = new FormData(form);
  const text = (name: IntakeField) => String(data.get(name) ?? "").trim();
  const optional = (name: IntakeField) => text(name) || null;

  return {
    petName: text("petName"),
    species: text("species"),
    breed: optional("breed"),
    age: optional("age"),
    ownerName: text("ownerName"),
    ownerPhone: text("ownerPhone"),
    chiefComplaint: text("chiefComplaint"),
    priority: text("priority") as AcuityLevel,
    triageNotes: optional("triageNotes"),
    allergies: optional("allergies"),
    medications: optional("medications"),
    treatmentAuthorization: (text("treatmentAuthorization") || "notDiscussed") as TreatmentAuthorization,
    referringClinic: optional("referringClinic")
  };
}

// The API names fields in PascalCase ("OwnerName"); match them ignoring case.
function toFieldErrors(apiErrors: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, message] of Object.entries(apiErrors)) {
    const field = fieldOrder.find((name) => name.toLowerCase() === key.replace(/^\$\./, "").toLowerCase());
    if (field) {
      errors[field] = message;
    }
  }
  return errors;
}

// The prototype's "New patient intake" dialog (build plan 4.1b). A native modal
// dialog keeps focus inside, closes on Escape and returns focus to the button
// that opened it. Nothing typed is lost when the API refuses the form.
export function IntakeDialog({ isOpen, onClose, onCreated }: IntakeDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      setFieldErrors({});
      setFormError(null);
      dialog.showModal();
      // Start on Patient name, as the prototype does.
      formRef.current?.querySelector<HTMLElement>('[name="petName"]')?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  function showErrors(errors: FieldErrors) {
    setFieldErrors(errors);
    const first = fieldOrder.find((field) => errors[field]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const request = readRequest(form);
    const missing: FieldErrors = {};
    for (const [field, message] of requiredFields) {
      if (!request[field]) {
        missing[field] = message;
      }
    }

    setFormError(null);
    if (Object.keys(missing).length > 0) {
      showErrors(missing);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    try {
      const result = await createIntake(request);
      form.reset();
      onCreated(result, request.petName);
      dialogRef.current?.close();
    } catch (error) {
      if (error instanceof FormRejectedError && Object.keys(toFieldErrors(error.fieldErrors)).length > 0) {
        showErrors(toFieldErrors(error.fieldErrors));
      } else if (error instanceof SessionEndedError) {
        setFormError("Your session has ended. Sign in again to add the patient.");
      } else {
        setFormError("The patient couldn't be added. Check the details and try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const fieldId = (field: IntakeField) => `${id}-${field}`;
  const errorId = (field: IntakeField) => `${id}-${field}-error`;

  // The attributes that name a field and link it to its error.
  function fieldProps(field: IntakeField) {
    return {
      id: fieldId(field),
      name: field,
      "aria-invalid": fieldErrors[field] ? true : undefined,
      "aria-describedby": fieldErrors[field] ? errorId(field) : undefined
    };
  }

  function fieldError(field: IntakeField) {
    const message = fieldErrors[field];
    return message ? <FieldError id={errorId(field)} text={message} /> : null;
  }

  const titleId = `${id}-title`;

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
          <p className={styles.eyebrow}>Patient flow</p>
          <h2 id={titleId} className={styles.title}>New patient intake</h2>
          <p className={styles.tiny}>Capture arrival details, then add the patient to the triage queue.</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close intake form"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate>
        <div className={styles.body}>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor={fieldId("petName")}>Patient name *</label>
              <input {...fieldProps("petName")} required autoComplete="off" placeholder="e.g. Milo" />
              {fieldError("petName")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("species")}>Species *</label>
              <select {...fieldProps("species")} required defaultValue="">
                <option value="">Select species</option>
                <option>Dog</option>
                <option>Cat</option>
                <option>Other</option>
              </select>
              {fieldError("species")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("breed")}>Breed / description</label>
              <input {...fieldProps("breed")} autoComplete="off" placeholder="Breed or identifying details" />
              {fieldError("breed")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("age")}>Age</label>
              <input {...fieldProps("age")} autoComplete="off" placeholder="e.g. 8 years" />
              {fieldError("age")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("ownerName")}>Pet parent / guardian *</label>
              <input {...fieldProps("ownerName")} required autoComplete="off" placeholder="Full name" />
              {fieldError("ownerName")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("ownerPhone")}>Phone number *</label>
              <input {...fieldProps("ownerPhone")} type="tel" required autoComplete="off" placeholder="Best callback number" />
              {fieldError("ownerPhone")}
            </div>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor={fieldId("chiefComplaint")}>Chief complaint *</label>
              <input {...fieldProps("chiefComplaint")} required autoComplete="off" placeholder="Reason for visit / presenting concern" />
              {fieldError("chiefComplaint")}
            </div>
            <fieldset
              className={`${styles.field} ${styles.full} ${styles.priority}`}
              aria-invalid={fieldErrors.priority ? true : undefined}
              aria-describedby={fieldErrors.priority ? errorId("priority") : undefined}
            >
              <legend className={styles.groupLabel}>Initial priority *</legend>
              <div className={styles.severity}>
                <label><input type="radio" name="priority" value="critical" /> Critical / immediate</label>
                <label><input type="radio" name="priority" value="urgent" /> Urgent</label>
                <label><input type="radio" name="priority" value="stable" /> Stable</label>
              </div>
              {fieldError("priority")}
            </fieldset>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor={fieldId("triageNotes")}>Triage notes</label>
              <textarea {...fieldProps("triageNotes")} placeholder="Observed signs, onset, pertinent history, and immediate needs" />
              {fieldError("triageNotes")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("allergies")}>Known allergies</label>
              <input {...fieldProps("allergies")} autoComplete="off" placeholder="Unknown if not confirmed" />
              {fieldError("allergies")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("medications")}>Current medications</label>
              <input {...fieldProps("medications")} autoComplete="off" placeholder="Medication and last dose, if known" />
              {fieldError("medications")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("treatmentAuthorization")}>Initial treatment authorization</label>
              <select {...fieldProps("treatmentAuthorization")} defaultValue="notDiscussed">
                <option value="notDiscussed">Not discussed</option>
                <option value="pending">Pending</option>
                <option value="authorized">Authorized</option>
                <option value="declined">Declined</option>
              </select>
              {fieldError("treatmentAuthorization")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fieldId("referringClinic")}>Referring clinic (if applicable)</label>
              <input {...fieldProps("referringClinic")} autoComplete="off" placeholder="Clinic name" />
              {fieldError("referringClinic")}
            </div>
          </div>
          <p className={styles.note}>
            Arrival time is recorded on submission. Priority is provisional until a clinician completes
            triage. Record pain using your clinic’s approved scale.
          </p>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving}>
            {isSaving ? "Adding…" : "Add to triage queue"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
