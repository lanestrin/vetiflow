# Fix: Split 4.13a into phase 1 and deferred phase 2 items in the build plan

**Type:** Fix
**Status:** complete
**Branch:** `fix/split-4-13a-phases`
**Audit:** not needed - documentation only: the build plan's item lines change; no application code, data or configuration changes.

## The problem

Item 4.13a ("after the action-selection decision") couples two things that
should not wait on each other. The Patient Overview's Care Coordination card
needs documented priority, assignee and due state now, and needs no clinical
approval. The automatic selection of one next action is clinically unapproved
and depends on the My Patients workspace, which has not been built.

Reproduce: read the build plan, lines 348-350. 4.13a and 4.13b both wait on the
unapproved selection rule, so the overview redesign appears blocked when it is not.

## The fix

Edit the build plan's item lines only (not the Decisions text except one note):

- **4.13a** becomes phase 1 data: the documented priority that staff set (shown as "Not prioritized" when unset), the responsible assignee, state and source task, with migrations and tests; no ranking, no automatic selection, no implied veterinarian approval.
- **4.13b** becomes phase 1 display: the Care Coordination card showing the staff-identified next action, its assignee or "Not assigned", its state, "No next action documented" when empty, with Current Location and its dropdown beneath; not blocked on My Patients.
- **4.13d** (new; 4.13c is an existing item and is not renumbered) is the deferred phase 2 server-side automatic selection, waiting on clinical validation of the rule and integration with My Patients review and priority workflows (2.22c, 4.16c, 4.17c). Creating My Patients is not clinical approval.
- The Decisions bullet for the proposed rule gains one note: it governs only 4.13d, and phase 1 needs no approval.

The rest of the build plan, including 4.13c and every other item, stays exactly as it is.

## Build steps

- [x] **Step 1 - split the item lines** - apply the edits above to `blueprint/build-plan.md` and nothing else. *Done when:* `git diff --check` is clean; `git diff --stat` shows one file; `grep -o "\*\*4\.13[a-z]*\*\*"` finds exactly one each of 4.13a, 4.13b, 4.13c (existing) and 4.13d (new); 4.13a and 4.13b both say "phase 1"; 4.13d says "phase 2, deferred".

## Verify

- `scripts/verify.ps1` (workflow scope: no application files change).
- No app check: nothing in the running app changes.
- Reviewer check: the phase 2 item names the three My Patients items it depends on, and 4.13b says it is not blocked on My Patients.

## Result

- **Prepared:** branch `fix/split-4-13a-phases`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-02, scope workflow (reused from 2026-11-02T15:16:53Z, fix/split-4-13a-phases @ 6de6821)
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
- **Step evidence:** each of 4.13a, 4.13b, 4.13c (existing) and 4.13d (new) appears once; 4.13a and 4.13b say "phase 1"; 4.13d says "phase 2, deferred".
- **Check:** not needed; nothing in the running app changes.
- **Audit:** not needed (documentation only).
- **Follow-ups added to build plan:** the new item 4.13d (deferred phase 2) is the follow-up; it is already in the build plan, with its dependencies named.
- **Deploy notes:** none.
- **Built differently from the spec:** the spec said to renumber nothing and to add the phase 2 item as 4.13c, but 4.13c is an existing item (clinical-task-performance), so the phase 2 item is 4.13d. The existing items were not renumbered.
