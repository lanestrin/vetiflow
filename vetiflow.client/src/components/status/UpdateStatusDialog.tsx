import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { stageLabel, caseStatusLabel } from "../board/boardFormat";
import { CaseGoneError, ChangeRefusedError } from "../../services/apiErrors";
import { updateCaseStatus } from "../../services/casesApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { CaseStage, CaseStatus } from "../../types/EmergencyCaseListItem";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useClinicalDraft } from "../forms/useClinicalDraft";
import styles from "./UpdateStatusDialog.module.scss";

const stages: CaseStage[] = ["incoming", "triage", "treatment", "diagnostics", "recheck", "discharge"];

const statuses: CaseStatus[] = ["unassigned", "assigned", "waiting", "inProgress", "blocked", "readyForNextStep", "completed"];

interface UpdateStatusDialogProps {
  detail: CaseDetail;
  caseUnavailable?: boolean;
  onClose: () => void;
  // The toast to show; the caller reloads the panel and the board.
  onSaved: (message: string) => void;
}

// Changes a case's stage, status and next action together (build plan 4.9b),
// in the same native modal pattern as the triage dialog. The stage rules are
// the server's: a refused move shows its reason and nothing is saved. Nothing
// typed is lost on an error.
export function UpdateStatusDialog({ detail, caseUnavailable = false, onClose, onSaved }: UpdateStatusDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const draft = useClinicalDraft(dialogRef, formRef);
  const [target] = useState(detail);
  const [isGone, setIsGone] = useState(false);
  const unavailable = caseUnavailable || isGone || detail.dischargedAt !== null;
  const leaveWhenRefused = useLeaveWhenRefused();
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
    const stage = data.get("stage") as CaseStage;
    const status = data.get("status") as CaseStatus;
    const nextAction = String(data.get("nextAction") ?? "").trim() || null;

    setFormError(null);
    if (!draft.startSaving()) return;
    setIsSaving(true);
    try {
      await updateCaseStatus(target.id, { stage, status, nextAction });
      if (!draft.isActive()) return;
      draft.saved();
      dialogRef.current?.close();
      onSaved("Status updated");
    } catch (error) {
      if (!draft.isActive() || leaveWhenRefused(error)) {
        return;
      }

      if (error instanceof ChangeRefusedError) {
        setFormError(error.reason);
      } else if (error instanceof CaseGoneError) {
        setIsGone(true);
        setFormError("This case is no longer on the board.");
      } else {
        setFormError("Unable to update status. Try again.");
      }
    } finally {
      draft.finishSaving();
      if (draft.isActive()) setIsSaving(false);
    }
  }

  const titleId = `${id}-title`;

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
          <h2 id={titleId} className={styles.title}>Update status</h2>
          <p className={styles.tiny}>{target.patient.name} · Case {target.caseNumber}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close update status"
          disabled={isSaving} onClick={draft.dismiss}
        >
          ×
        </button>
      </div>

      <form ref={formRef} {...draft.formProps} onSubmit={submit} noValidate aria-labelledby={titleId} aria-busy={isSaving}>
        <div className={styles.body}>
          {(formError || unavailable) && <p className={styles.formError} role="alert">{formError ?? "This case is no longer available for changes."}</p>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-stage`}>Stage</label>
            <select ref={firstFieldRef} id={`${id}-stage`} name="stage" defaultValue={target.stage} disabled={unavailable}>
              {stages.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-status`}>Status</label>
            <select id={`${id}-status`} name="status" defaultValue={target.status} disabled={unavailable}>
              {statuses.map(status => <option key={status} value={status}>{caseStatusLabel(status)}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-next`}>Next action</label>
            <input
              id={`${id}-next`}
              name="nextAction"
              type="text"
              defaultValue={target.nextAction ?? ""}
              disabled={unavailable}
            />
          </div>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={draft.dismiss}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable}>
            {isSaving ? "Saving…" : "Save status"}
          </button>
        </div>
      </form>
    </dialog>
    {draft.confirmation}
    </>
  );
}
