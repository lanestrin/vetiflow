import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, FormRejectedError } from "../../services/apiErrors";
import { recordVitals } from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { RecordVitalsRequest } from "../../types/RecordVitalsRequest";
import { FieldError } from "../auth/FormMessages";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import styles from "./RecordVitalsDialog.module.scss";

const readings = [
  { name: "heartRate", label: "Heart rate (bpm)", min: 1, max: 400 },
  { name: "respiratoryRate", label: "Respiratory rate (/min)", min: 1, max: 200 },
  { name: "temperatureC", label: "Temperature (°C)", min: 26.7, max: 46.1 },
  { name: "spO2", label: "SpO₂ (%)", min: 50, max: 100 }
] as const;
const observations = [
  { name: "mucousMembraneColor", label: "Mucous membrane colour" },
  { name: "capillaryRefillTime", label: "Capillary refill time" },
  { name: "mentation", label: "Mentation" }
] as const;
type Field = typeof readings[number]["name"] | typeof observations[number]["name"];
const fields = [...readings, ...observations];
const emptySetError = "Enter at least one reading or observation.";
const temperatureError = "Enter a temperature from 26.7 to 46.1 °C, with at most one decimal place.";

interface RecordVitalsDialogProps {
  detail: CaseDetail;
  onClose: () => void;
  onSaved: () => void;
  onUnavailable: () => void;
}

export function RecordVitalsDialog({ detail, onClose, onSaved, onUnavailable }: RecordVitalsDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const active = useRef(false);
  const saving = useRef(false);
  const leaveWhenRefused = useLeaveWhenRefused();
  // A background refetch must not change which patient this draft belongs to.
  const [target] = useState({ id: detail.id, name: detail.patient.name, number: detail.caseNumber });
  const [initial] = useState(() => {
    const latest = detail.vitals[0];
    const temperatureF = latest?.temperatureF ?? null;
    return {
      heartRate: latest?.heartRate ?? "",
      respiratoryRate: latest?.respiratoryRate ?? "",
      temperatureC: temperatureF === null ? "" : ((temperatureF - 32) * 5 / 9).toFixed(1),
      spO2: latest?.spO2 ?? "",
      mucousMembraneColor: latest?.mucousMembraneColor ?? "",
      capillaryRefillTime: latest?.capillaryRefillTime ?? "",
      mentation: latest?.mentation ?? "",
      temperatureF
    };
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGone, setIsGone] = useState(false);
  const [errorFocus, setErrorFocus] = useState<Field | null>(null);
  const unavailable = isGone || detail.dischargedAt !== null;

  function focusField(field: Field) {
    const input = formRef.current?.elements.namedItem(field);
    if (input instanceof HTMLInputElement) input.focus();
  }

  useEffect(() => {
    active.current = true;
    dialogRef.current?.showModal();
    const input = formRef.current?.elements.namedItem("heartRate");
    if (input instanceof HTMLInputElement) input.focus();
    return () => { active.current = false; };
  }, []);

  // Server validation arrives while controls are disabled; wait for re-enable.
  useEffect(() => {
    if (!isSaving && errorFocus !== null) {
      const input = formRef.current?.elements.namedItem(errorFocus);
      if (input instanceof HTMLInputElement) input.focus();
    }
  }, [errorFocus, isSaving]);

  function dismiss() {
    if (!saving.current) dialogRef.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || unavailable) return;
    const data = new FormData(event.currentTarget);
    const request: RecordVitalsRequest = {};
    const errors: Partial<Record<Field, string>> = {};

    for (const field of readings) {
      const text = String(data.get(field.name) ?? "").trim();
      if (text === "") continue;
      const value = Number(text);
      const isTemperature = field.name === "temperatureC";
      const precisionValid = isTemperature
        ? Math.abs(value * 10 - Math.round(value * 10)) < 1e-8
        : Number.isInteger(value);
      if (!/^-?\d+(\.\d+)?$/.test(text) || !Number.isFinite(value) || !precisionValid || value < field.min || value > field.max) {
        errors[field.name] = isTemperature ? temperatureError : `Enter a whole number from ${field.min} to ${field.max}.`;
      } else if (field.name === "temperatureC") {
        const fahrenheit = initial.temperatureF !== null && value === Number(initial.temperatureC)
          ? initial.temperatureF
          : Math.round((value * 9 / 5 + 32) * 10) / 10;
        if (fahrenheit < 80 || fahrenheit > 115) errors.temperatureC = temperatureError;
        else request.temperatureF = fahrenheit;
      } else {
        request[field.name] = value;
      }
    }
    for (const field of observations) {
      const text = String(data.get(field.name) ?? "").trim();
      if (text.length > 50) errors[field.name] = "Use 50 characters or fewer.";
      else if (text !== "") request[field.name] = text;
    }

    setFieldErrors(errors);
    setFormError(null);
    const firstInvalid = fields.find(field => errors[field.name]);
    if (firstInvalid) {
      focusField(firstInvalid.name);
      return;
    }
    if (Object.keys(request).length === 0) {
      setFormError(emptySetError);
      focusField("heartRate");
      return;
    }

    saving.current = true;
    setErrorFocus(null);
    setIsSaving(true);
    try {
      await recordVitals(target.id, request);
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
        let readingsError = false;
        for (const [key, message] of Object.entries(error.fieldErrors)) {
          const name = key.replace(/^\$\./, "").toLowerCase();
          if (name === "readings") readingsError = true;
          if (name === "temperaturef") mapped.temperatureC = temperatureError;
          else {
            const field = fields.find(field => field.name.toLowerCase() === name);
            if (field) mapped[field.name] = message;
          }
        }
        setFieldErrors(mapped);
        setFormError(readingsError ? emptySetError : Object.keys(mapped).length === 0 ? "Unable to save vitals. Try again." : null);
        const invalid = fields.find(field => mapped[field.name]);
        setErrorFocus(invalid?.name ?? "heartRate");
      } else {
        setFormError("Unable to save vitals. Try again.");
      }
    } finally {
      saving.current = false;
      if (active.current) setIsSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`}
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}>
      <header className={styles.head}>
        <div>
          <h2 id={`${id}-title`} className={styles.title}>Record vitals</h2>
          <p className={styles.meta}>{target.name} · Case {target.number}</p>
        </div>
        <button type="button" className={styles.close} aria-label="Close record vitals" disabled={isSaving} onClick={dismiss}>×</button>
      </header>
      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby={`${id}-title`} aria-busy={isSaving}>
        <div className={styles.body}>
          <p className={styles.hint} id={`${id}-hint`}>Review all values before saving. Saving records the full form as a new set. Clear values that were not assessed.</p>
          {(formError || detail.dischargedAt !== null) && <p className={styles.formError} role="alert">
            {formError ?? "This case has been discharged."}
          </p>}
          <div className={styles.readings}>
            {readings.map(field => {
              const error = fieldErrors[field.name];
              return (
                <div className={styles.field} key={field.name}>
                  <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
                  <input
                    id={`${id}-${field.name}`}
                    name={field.name}
                    defaultValue={initial[field.name]}
                    type="text"
                    inputMode={field.name === "temperatureC" ? "decimal" : "numeric"}
                    autoComplete="off"
                    disabled={isSaving}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-${field.name}-error` : `${id}-hint`}
                  />
                  {error && <FieldError id={`${id}-${field.name}-error`} text={error} />}
                </div>
              );
            })}
          </div>
          {observations.map(field => {
            const error = fieldErrors[field.name];
            return (
              <div className={styles.field} key={field.name}>
                <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
                <input
                  id={`${id}-${field.name}`}
                  name={field.name}
                  defaultValue={initial[field.name]}
                  type="text"
                  maxLength={50}
                  autoComplete="off"
                  disabled={isSaving}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-${field.name}-error` : undefined}
                />
                {error && <FieldError id={`${id}-${field.name}-error`} text={error} />}
              </div>
            );
          })}
        </div>
        <footer className={styles.foot}>
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={dismiss}>Cancel</button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable}>{isSaving ? "Saving..." : "Save vitals"}</button>
        </footer>
      </form>
    </dialog>
  );
}
