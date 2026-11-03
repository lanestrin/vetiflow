# Fix: Remove finished items from the build plan

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/build-plan-cleanup`
- **Audit:** not needed - planning doc only; no application code, auth or data changes.

## The problem

`blueprint/build-plan.md` (723 lines) still lists 70 ticked items alongside the 110 still to do, so it is hard to see what is left. The file's own rule ("Rules for this list", line 9) says ticked items are removed at the next clean-up; the last one was on 2026-10-28.

Ticked items today, all single lines:

- **M2 (ER Board and Patient Overview):**
  - 0.4a-b, 2.10a-b, 3.4a, 2.11a-b, 4.1a-c, 4.2a-b, 2.12a-b
  - 2.14 and 2.14a-d, 2.21a-b, 2.15a-b, 3.2a-f, 4.4a-c
  - 4.8a-e, 4.8g-h, 3.6a-c, 2.23, 2.24, 2.25
  - 2.26 and 2.26a-c, 2.27 and 2.27a-b, 2.28
  - 4.11a-b, 4.12a-b, 4.13a, 4.9a-b, 3.5a-c, 4.3a-b
- **M3b (Shared clinical foundation):** 4.21a-d.
- **M4 (The rest of the rail):** 4.5.

Every one has its spec and result in `blueprint/history/features/`, by its ID or in its `From build-plan` line. The two exceptions are parent items, each recorded by its sub-items' files: 2.14 by 2.14a-d and 2.27 by 2.27a-b.

## The fix

- Delete the 70 ticked item lines. Leave every unticked item, heading, rule, Decision and section intro exactly as it is, including references to finished IDs (for example "after 4.3a"). Those IDs stay meaningful through their history files and are never reused.
- Remove the 17 M2 group labels left with no items (for example "**Acuity in three levels**", "**App shell**"; none had text of its own), and the M2 intro's sentence "Completed rows below describe what shipped, not instructions to reproduce superseded UI.", which no longer refers to anything. Added while building, when the removal left those labels empty.
- Update the rule's date: "Cleaned up on 2026-10-28" becomes "Cleaned up on 2026-10-28 and 2026-11-03".
- Must not break:
  - the unticked items' order (file order is build order);
  - `/status`'s "first unticked item";
  - Verify's workflow tests (`scripts/tests/`, which use their own fixture, not this file).

## Build steps

- [x] **Step 1 - remove the ticked items** - delete the 70 lines, the empty group labels and the stale intro sentence, and update the clean-up date. *Done when:* `build-plan.md` has no `- [x]` line; it still has the same 110 unticked items in the same order (compared with `main`); the first unticked item is still 4.13b; and `git diff --check` is clean.

## Verify

- `scripts/verify.ps1` (workflow scope: the change is under `blueprint/`).
- No `/check`: nothing changes in the app.

## Result

- **Prepared:** branch `fix/build-plan-cleanup`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-03, scope workflow (reused from 2026-11-03T17:28:07Z, fix/build-plan-cleanup @ 1fae264)
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
- **Check:** not run; nothing changes in the app. Instead, compared with `main`: no `- [x]` line remains; the 110 unticked item lines are identical and in the same order; the first unticked item is still 4.13b; the diff is 126 lines removed and 2 changed (the clean-up date and the M2 intro); `git diff --check` is clean. `build-plan.md` went from 723 to 599 lines.
- **Audit:** not needed (planning doc only).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none
