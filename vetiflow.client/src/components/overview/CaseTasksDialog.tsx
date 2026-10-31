import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { completeTask, reopenTask } from "../../services/casesApi";
import type { CaseDetail, CaseDueItem, CaseTask } from "../../types/CaseDetail";
import { useLeaveWhenRefused } from "../auth/useLeaveWhenRefused";
import { useNow } from "../board/useNow";
import { useToast } from "../shell/toastContext";
import { dueLabel } from "./overviewFormat";
import styles from "./CaseTasksDialog.module.scss";

interface CaseTasksDialogProps {
  detail: CaseDetail;
  triggerRef: RefObject<HTMLButtonElement | null>;
  fallbackRef: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  onTaskSaved: () => void;
}

export function CaseTasksDialog({ detail, triggerRef, fallbackRef, onClose, onTaskSaved }: CaseTasksDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    closeRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => {
        onClose();
        if (triggerRef.current?.isConnected) triggerRef.current.focus();
        else fallbackRef.current?.focus();
      }}
    >
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Patient overview</p>
          <h2 className={styles.title} id={titleId}>Tasks and due items</h2>
          <p className={styles.identity}>{detail.patient.name} · Case {detail.caseNumber}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          aria-label="Close tasks and due items"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </header>
      <div className={styles.body}>
        <section aria-label="Due items">
          <h3 className={styles.sectionTitle}>Due items</h3>
          <DueItemRow
            caseId={detail.id}
            label="Next reassessment"
            item={detail.nextReassessment}
            onTaskSaved={onTaskSaved}
          />
          <DueItemRow
            caseId={detail.id}
            label="Client update"
            item={detail.nextClientUpdate}
            onTaskSaved={onTaskSaved}
          />
        </section>
        <section aria-label="Tasks">
          <h3 className={styles.sectionTitle}>Tasks</h3>
          {detail.tasks.filter(task => task.type === "task" && task.status !== "cancelled").length === 0
            ? <p className={styles.empty}>No tasks yet.</p>
            : <TaskChecklist caseId={detail.id} caseTasks={detail.tasks} onTaskSaved={onTaskSaved} />}
        </section>
      </div>
    </dialog>
  );
}

function DueItemRow({
  caseId,
  label,
  item,
  onTaskSaved
}: {
  caseId: string;
  label: string;
  item: CaseDueItem | null;
  onTaskSaved: () => void;
}) {
  const now = useNow();
  const leaveWhenRefused = useLeaveWhenRefused();
  const showToast = useToast();
  const [isSaving, setIsSaving] = useState(false);

  async function complete() {
    if (!item || isSaving) return;
    setIsSaving(true);
    try {
      await completeTask(caseId, item.id);
    } catch (saveError) {
      if (leaveWhenRefused(saveError)) return;
      showToast("Couldn't update the task. Try again.");
    } finally {
      setIsSaving(false);
    }
    onTaskSaved();
  }

  return (
    <div className={styles.dueItem}>
      <div>
        <strong>{label}</strong>
        <p>{item ? `${item.description} · ${dueLabel(item.dueAt, now)}` : "Not scheduled"}</p>
        {item?.assignedTo && <small>Assigned to {item.assignedTo.name}</small>}
      </div>
      {item && (
        <button
          type="button"
          className={styles.done}
          aria-label={`Mark ${label.toLowerCase()} done`}
          aria-disabled={isSaving || undefined}
          onClick={() => void complete()}
        >
          Done
        </button>
      )}
    </div>
  );
}

interface TaskChecklistProps {
  caseId: string;
  caseTasks: CaseTask[];
  onTaskSaved: () => void;
}

function TaskChecklist({ caseId, caseTasks, onTaskSaved }: TaskChecklistProps) {
  const leaveWhenRefused = useLeaveWhenRefused();
  const showToast = useToast();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [followedTasks, setFollowedTasks] = useState(caseTasks);
  if (caseTasks !== followedTasks) {
    setFollowedTasks(caseTasks);
    setTicked({});
  }
  const tasks = caseTasks.filter(task => task.type === "task" && task.status !== "cancelled");

  async function toggle(task: CaseTask, isDone: boolean) {
    setTicked(current => ({ ...current, [task.id]: isDone }));
    setSavingId(task.id);

    try {
      await (isDone ? completeTask(caseId, task.id) : reopenTask(caseId, task.id));
    } catch (saveError) {
      if (leaveWhenRefused(saveError)) return;
      setTicked(current => {
        const reverted = { ...current };
        delete reverted[task.id];
        return reverted;
      });
      showToast("Couldn't update the task. Try again.");
    } finally {
      setSavingId(null);
    }

    onTaskSaved();
  }

  return (
    <ul className={styles.tasks}>
      {tasks.map(task => {
        const isDone = ticked[task.id] ?? task.status === "done";
        return (
          <li key={task.id} className={styles.task} data-done={isDone}>
            <label>
              <input
                type="checkbox"
                checked={isDone}
                disabled={savingId === task.id}
                onChange={event => void toggle(task, event.target.checked)}
              />
              <span>{task.description}</span>
            </label>
            <span className={styles.meta}>{task.assignedTo?.name ?? (isDone ? "Completed" : "Unassigned")}</span>
          </li>
        );
      })}
    </ul>
  );
}
