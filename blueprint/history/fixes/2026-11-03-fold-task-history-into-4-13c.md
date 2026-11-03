# Fix: Fold task assignment history (4.13e) into 4.13c

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/fold-task-history-into-4-13c`
- **Audit:** not needed - planning docs only; no application code, auth or data changes.

## The problem

`blueprint/build-plan.md` line 351 lists **4.13e** `feature/task-assignment-history`: "assigner tracking and reassignment history for tasks … with its own history model and migration". It is the next open item in M2, but nothing it would record exists yet:

- **No reassignment workflow.** A task's assignee is set only when it is created (`CaseTasksController`, `POST /api/cases/{id}/tasks`). No endpoint or screen changes it, so a history table would only repeat the creator and assignee the task already stores.
- **The plan rules out building ahead.** The "Build the simplest working version first" decision (2026-11-02) says not to add a model for a workflow that does not exist yet.
- **4.13c already covers it.** **4.13c** `feature/clinical-task-performance` (M3b, line 474) delivers "permitted task assignment/reassignment/performance documentation with actual performer, entered/event times and history", after the chart views.
- **The authority is undecided.** Who may reassign is still open in product rules section 16.

The person decided on 2026-11-03 to fold 4.13e into 4.13c, so the history is built with the reassignment workflow it records.

## The fix

- **`blueprint/build-plan.md`:**
  - Remove the 4.13e line and its now-empty "**Deferred task history**" group label in M2.
  - Add to the Dropped section: "**4.13e** `feature/task-assignment-history`: merged into 4.13c (decided 2026-11-03, by the person): assignment history is built with the reassignment workflow it records, under the simplicity decision; no model is added before that workflow exists."
  - Extend 4.13c's line so nothing from 4.13e is lost: "…with actual performer, entered/event times and history, including who created, assigned and reassigned each task and when (folded in from 4.13e)." Everything else in its line stays.
- **`blueprint/reference/er-board-poc/README.md`** line 72: "Care tasks performance and history (8) | 4.13c, 4.13e" becomes "| 4.13c".
- Unchanged: 4.13e's ID is never reused; the 4.13a and 4.13b history files that mention it stay as written.

## Build steps

- [x] **Step 1 - fold 4.13e into 4.13c** - the three build-plan edits and the README mapping. *Done when:*
  - `**4.13e**` appears in `build-plan.md` only under Dropped;
  - 4.13c's line names the creator, assigner and reassignment history;
  - "Deferred task history" is gone;
  - the README row lists only 4.13c;
  - the other open items are unchanged and in the same order (compared with `main`), the first being 2.16a;
  - `git diff --check` is clean.

## Verify

- `scripts/verify.ps1` (workflow scope: planning docs only).
- No `/check`: nothing changes in the app.

## Result

- **Prepared:** branch `fix/fold-task-history-into-4-13c`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-03, scope workflow (reused from 2026-11-03T20:37:23Z, fix/fold-task-history-into-4-13c @ 55bd182)
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
- **Check:** not run; nothing changes in the app. Instead, compared with `main`: `**4.13e**` appears only under Dropped; "Deferred task history" is gone; 4.13c ends "…and history, including who created, assigned and reassigned each task and when (folded in from 4.13e)."; the other open items are unchanged and in the same order (109 open before, 108 after); the first open item is 2.16a; the README row lists only 4.13c; `git diff --check` is clean.
- **Audit:** not needed (planning docs only).
- **Follow-ups added to build plan:** none. Planned next as its own `/fix` (the person, 2026-11-03): trim the demo seed to 11 cases and add a local-only database reset to `scripts/db-target.ps1`, so the board shows fewer than 12 patients.
- **Deploy notes:** none
