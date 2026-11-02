import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CaseGoneError, RoomInUseError } from "../../services/apiErrors";
import { setCaseRoom } from "../../services/casesApi";
import { getRooms } from "../../services/roomsApi";
import type { CaseDetail } from "../../types/CaseDetail";
import type { Room } from "../../types/Room";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useClinicalDraft } from "../forms/useClinicalDraft";
import { locationLabel } from "./overviewFormat";
import styles from "../tasks/TaskDialog.module.scss";

type Rooms = { kind: "loading" } | { kind: "shown"; list: Room[] } | { kind: "failed" };

interface ChangeLocationDialogProps {
  detail: CaseDetail;
  caseUnavailable?: boolean;
  onClose: () => void;
  // The toast to show; the caller reloads the board and the panel.
  onSaved: (message: string) => void;
}

// Moves the case to another room, or to no room (build plan 4.3b), as a native
// modal like the other overview dialogs. A room holding another active case is
// shown but cannot be chosen; if someone takes the chosen room first, the
// server refuses and the list reloads.
export function ChangeLocationDialog({ detail, caseUnavailable = false, onClose, onSaved }: ChangeLocationDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const roomRef = useRef<HTMLSelectElement>(null);
  const draft = useClinicalDraft(dialogRef, formRef);
  const [target] = useState(detail);
  const [isGone, setIsGone] = useState(false);
  const unavailable = caseUnavailable || isGone || detail.dischargedAt !== null;
  const leaveWhenRefused = useLeaveWhenRefused();
  const [rooms, setRooms] = useState<Rooms>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    roomRef.current?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadRooms() {
      try {
        const list = await getRooms();
        if (isActive) setRooms({ kind: "shown", list });
      } catch (loadError) {
        if (isActive && !leaveWhenRefused(loadError)) setRooms({ kind: "failed" });
      }
    }

    void loadRooms();

    return () => {
      isActive = false;
    };
  }, [attempt, leaveWhenRefused]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.isSaving() || !draft.isActive() || unavailable || rooms.kind !== "shown") return;
    const roomId = String(new FormData(event.currentTarget).get("room") ?? "") || null;

    setFormError(null);
    if (roomId === (target.room?.id ?? null)) {
      draft.saved();
      dialogRef.current?.close();
      return;
    }

    if (!draft.startSaving()) return;
    setIsSaving(true);
    try {
      await setCaseRoom(target.id, roomId);
      if (!draft.isActive()) return;
      draft.saved();
      dialogRef.current?.close();
      onSaved("Location updated");
    } catch (error) {
      if (!draft.isActive() || leaveWhenRefused(error)) {
        return;
      }

      if (error instanceof RoomInUseError) {
        const name = rooms.list.find(room => room.id === roomId)?.name ?? "This room";
        setFormError(`${name} is now in use${error.caseNumber ? ` by ${error.caseNumber}` : ""}. Choose another room.`);
        setAttempt(count => count + 1);
      } else if (error instanceof CaseGoneError) {
        setIsGone(true);
        setFormError("This case is no longer on the board.");
      } else {
        setFormError("Unable to save. Try again.");
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
          <p className={styles.eyebrow}>Patient overview</p>
          <h2 id={titleId} className={styles.title}>Change location</h2>
          <p className={styles.tiny}>{target.patient.name} · Case {target.caseNumber}</p>
        </div>
        <button type="button" className={styles.close} aria-label="Close change location" disabled={isSaving} onClick={draft.dismiss}>
          ×
        </button>
      </div>

      <form ref={formRef} {...draft.formProps} onSubmit={submit} noValidate aria-labelledby={titleId} aria-busy={isSaving}>
        <div className={styles.body}>
          {(formError || unavailable) && <p className={styles.formError} role="alert">{formError ?? "This case is no longer available for changes."}</p>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-room`}>Room</label>
            {/* Keyed by the list, so a reload after a refusal shows the rooms as they are now. */}
            <select
              key={rooms.kind === "shown" ? `shown-${attempt}` : rooms.kind}
              ref={roomRef}
              id={`${id}-room`}
              name="room"
              defaultValue={target.room?.id ?? ""}
              disabled={unavailable || rooms.kind !== "shown"}
            >
              <option value="">No room</option>
              {rooms.kind !== "shown" && target.room && <option value={target.room.id}>{locationLabel(target.room)}</option>}
              {rooms.kind === "shown" && rooms.list.map(room => {
                const occupant = room.occupiedBy && room.occupiedBy.id !== target.id ? room.occupiedBy : null;
                return (
                  <option key={room.id} value={room.id} disabled={occupant !== null}>
                    {locationLabel(room)}{occupant ? ` · In use · ${occupant.caseNumber}` : ""}
                  </option>
                );
              })}
            </select>
            {rooms.kind === "loading" && <p className={styles.hint}>Loading rooms…</p>}
            {rooms.kind === "failed" && (
              <p className={styles.hint} role="alert">
                Unable to load rooms.{" "}
                <button type="button" className={styles.secondary} onClick={() => setAttempt(count => count + 1)}>Try again</button>
              </p>
            )}
          </div>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.secondary} disabled={isSaving} onClick={draft.dismiss}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={isSaving || unavailable || rooms.kind !== "shown"}>
            {isSaving ? "Saving…" : "Save location"}
          </button>
        </div>
      </form>
    </dialog>
    {draft.confirmation}
    </>
  );
}
