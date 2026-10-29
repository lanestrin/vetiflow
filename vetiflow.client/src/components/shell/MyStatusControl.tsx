import { useEffect, useId, useState } from "react";
import { AccessDeniedError } from "../../services/apiErrors";
import { getMyStatus, setMyStatus } from "../../services/staffApi";
import { staffStatusLabel, staffStatusOptions, type StaffStatus } from "../../types/StaffStatus";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import styles from "./MyStatusControl.module.scss";
import { useToast } from "./toastContext";

type LoadState =
  | { kind: "loading" }
  // Not a veterinarian or technician (403): they have no status.
  | { kind: "hidden" }
  | { kind: "failed" }
  | { kind: "loaded"; status: StaffStatus };

// The prototype's "My status" (#availabilityStatus, build plan 2.21b). It
// loads when shown and saves on change, with a toast either way. A 403 here
// means a staff member with no status, not a pet parent, so it is handled
// before the usual leave-when-refused.
export function MyStatusControl() {
  const leaveWhenRefused = useLeaveWhenRefused();
  const showToast = useToast();
  const selectId = useId();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    getMyStatus()
      .then((status) => {
        if (isActive) {
          setState({ kind: "loaded", status });
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (error instanceof AccessDeniedError) {
          setState({ kind: "hidden" });
        } else if (!leaveWhenRefused(error)) {
          setState({ kind: "failed" });
        }
      });

    return () => {
      isActive = false;
    };
  }, [leaveWhenRefused]);

  async function choose(saved: StaffStatus, status: StaffStatus) {
    setState({ kind: "loaded", status });
    setIsSaving(true);

    try {
      await setMyStatus(status);
      showToast(`Availability set to ${staffStatusLabel(status)}`);
    } catch (error) {
      if (!(error instanceof AccessDeniedError) && leaveWhenRefused(error)) {
        return;
      }

      setState({ kind: "loaded", status: saved });
      showToast("Couldn't save your status. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (state.kind === "loading" || state.kind === "hidden") {
    return null;
  }

  if (state.kind === "failed") {
    return <p className={styles.unavailable}>Status unavailable</p>;
  }

  return (
    <div className={styles.availability}>
      <label htmlFor={selectId}>My status</label>
      <select
        id={selectId}
        className={styles.select}
        value={state.status}
        disabled={isSaving}
        onChange={(event) => void choose(state.status, event.target.value as StaffStatus)}
      >
        {staffStatusOptions.map((status) => (
          <option key={status} value={status}>{staffStatusLabel(status)}</option>
        ))}
      </select>
    </div>
  );
}
