import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { CaseGoneError } from "../../services/apiErrors";
import { setCaseTechnician, setCaseVeterinarian } from "../../services/casesApi";
import { getTeam } from "../../services/staffApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { CaseReference } from "../../types/EmergencyCaseListItem";
import type { TeamClinician } from "../../types/Team";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useClinicalDraft } from "../forms/useClinicalDraft";
import styles from "../tasks/TaskDialog.module.scss";

type Team = { kind: "loading" } | { kind: "shown"; list: TeamClinician[] } | { kind: "failed" };

type Member = "veterinarian" | "technician";

const memberLabels: Record<Member, string> = {
  veterinarian: "attending veterinarian",
  technician: "primary technician"
};

interface EditCareTeamDialogProps {
  detail: CaseDetail;
  caseUnavailable?: boolean;
  onClose: () => void;
  // The toast to show; the caller reloads the board and the panel.
  onSaved: (message: string) => void;
  // One change saved and the other did not: the caller reloads to show it.
  onPartlySaved: () => void;
}

// The attending veterinarian and primary technician of a case (build plan
// 4.3b), either of them "Not assigned". Only what changed is sent, the
// veterinarian first, through the one-field 4.3a endpoints.
export function EditCareTeamDialog({ detail, caseUnavailable = false, onClose, onSaved, onPartlySaved }: EditCareTeamDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const draft = useClinicalDraft(dialogRef, formRef);
  const [target] = useState(detail);
  // What the server holds, updated as each change saves.
  const [saved, setSaved] = useState<Record<Member, string | null>>({
    veterinarian: detail.assignedDoctor?.id ?? null,
    technician: detail.assignedTechnician?.id ?? null
  });
  const [isGone, setIsGone] = useState(false);
  const unavailable = caseUnavailable || isGone || detail.dischargedAt !== null;
  const leaveWhenRefused = useLeaveWhenRefused();
  const [team, setTeam] = useState<Team>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadTeam() {
      try {
        const list = await getTeam();
        if (isActive) setTeam({ kind: "shown", list });
      } catch (loadError) {
        if (isActive && !leaveWhenRefused(loadError)) setTeam({ kind: "failed" });
      }
    }

    void loadTeam();

    return () => {
      isActive = false;
    };
  }, [attempt, leaveWhenRefused]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.isSaving() || !draft.isActive() || unavailable || team.kind !== "shown") return;
    const data = new FormData(event.currentTarget);
    const chosen: Record<Member, string | null> = {
      veterinarian: String(data.get("veterinarian") ?? "") || null,
      technician: String(data.get("technician") ?? "") || null
    };
    const changes = (["veterinarian", "technician"] as const).filter(member => chosen[member] !== saved[member]);

    setFormError(null);
    if (changes.length === 0) {
      draft.saved();
      dialogRef.current?.close();
      return;
    }

    if (!draft.startSaving()) return;
    setIsSaving(true);
    let savedCount = 0;
    try {
      for (const member of changes) {
        await (member === "veterinarian" ? setCaseVeterinarian : setCaseTechnician)(target.id, chosen[member]);
        savedCount++;
        setSaved(current => ({ ...current, [member]: chosen[member] }));
      }
      if (!draft.isActive()) return;
      draft.saved();
      dialogRef.current?.close();
      onSaved("Care team updated");
    } catch (error) {
      if (!draft.isActive() || leaveWhenRefused(error)) {
        return;
      }

      if (error instanceof CaseGoneError) {
        setIsGone(true);
        setFormError("This case is no longer on the board.");
      } else if (savedCount > 0) {
        setFormError(`The ${memberLabels[changes[0]]} was saved, but the ${memberLabels[changes[1]]} was not. Try again.`);
      } else {
        setFormError("Unable to save. Try again.");
      }
      if (savedCount > 0) onPartlySaved();
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
          <p className={styles.eyebrow}>Patient overview</p>
          <h2 id={titleId} className={styles.title}>Edit care team</h2>
          <p className={styles.tiny}>{target.patient.name} · Case {target.caseNumber}</p>
        </div>
        <button type="button" className={styles.close} aria-label="Close edit care team" disabled={isSaving} onClick={draft.dismiss}>
          ×
        </button>
      </div>

      <form ref={formRef} {...draft.formProps} onSubmit={submit} noValidate aria-labelledby={titleId} aria-busy={isSaving}>
        <div className={styles.body}>
          {(formError || unavailable) && <p className={styles.formError} role="alert">{formError ?? "This case is no longer available for changes."}</p>}
          <MemberSelect
            id={`${id}-veterinarian`}
            selectRef={firstFieldRef}
            label="Attending veterinarian"
            name="veterinarian"
            current={target.assignedDoctor}
            team={team}
            role="veterinarian"
            disabled={unavailable}
          />
          <MemberSelect
            id={`${id}-technician`}
            label="Primary technician"
            name="technician"
            current={target.assignedTechnician}
            team={team}
            role="technician"
            disabled={unavailable}
          />
          {team.kind === "loading" && <p className={styles.hint}>Loading the team…</p>}
          {team.kind === "failed" && (
            <p className={styles.hint} role="alert">
              Unable to load the team.{" "}
              <button type="button" className={styles.secondary} onClick={() => setAttempt(count => count + 1)}>Try again</button>
            </p>
          )}
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={draft.dismiss}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable || team.kind !== "shown"}>
            {isSaving ? "Saving…" : "Save care team"}
          </button>
        </div>
      </form>
    </dialog>
    {draft.confirmation}
    </>
  );
}

interface MemberSelectProps {
  id: string;
  selectRef?: RefObject<HTMLSelectElement | null>;
  label: string;
  name: Member;
  current: CaseReference | null;
  team: Team;
  role: Member;
  disabled: boolean;
}

// The current person stays listed even when the team list leaves them out
// (deactivated since), so opening the dialog never changes the choice.
function MemberSelect({ id, selectRef, label, name, current, team, role, disabled }: MemberSelectProps) {
  const people = team.kind === "shown" ? team.list.filter(person => person.role === role) : [];
  const currentMissing = current !== null && !people.some(person => person.id === current.id);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <select
        key={team.kind}
        ref={selectRef}
        id={id}
        name={name}
        defaultValue={current?.id ?? ""}
        disabled={disabled || team.kind !== "shown"}
      >
        <option value="">Not assigned</option>
        {currentMissing && <option value={current.id}>{current.name}</option>}
        {people.map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}
      </select>
    </div>
  );
}
