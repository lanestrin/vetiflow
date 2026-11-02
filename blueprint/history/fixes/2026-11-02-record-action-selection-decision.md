# Fix: Record the proposed next-care-action rule as a build-plan decision

**Type:** Fix
**Status:** complete
**Branch:** `fix/record-action-selection-decision`
**Audit:** not needed - documentation only: one added decision bullet in the build plan; no application code, data or configuration changes.

## The problem

The build plan's Decisions section says only that an "Action selection" decision
is needed before 4.13a, and lists what it must cover. The agreed proposal (the
ordering rule, its provisional answers and the open clinical questions) lives
only in the conversation, so 4.13a has nothing to build from and the open
questions have no record for a veterinarian to approve.

Reproduce: read the "Action selection" bullet in `blueprint/build-plan.md`
(Decisions, around line 219). It names the topics but records no rule.

## The fix

Add one bullet directly after the existing "Action selection" bullet, recording
the proposed rule as **proposed, not final**:

- the ordering: explicit priority (Urgent, High, Routine, then "Not
  prioritized"), then clinical before administrative at equal priority, then due
  status (overdue, due soon, pending veterinarian review, other open tasks), then
  ties (earliest due time, oldest creation, task ID);
- the provisional answers to the three open questions: unset priority ranks below
  Routine and shows as "Not prioritized"; due soon means within 15 minutes, an
  initial default; overdue and due-soon clinical tasks rank ahead of unscheduled
  veterinarian review requests at equal priority and category;
- the rules that stay as agreed: waiting for vet review is a separate state, not
  an automatic Urgent priority; no open tasks shows "No next action documented";
  priority is set by veterinarians and authorized technicians; clinicians may
  change priority with an audit trail; the server selects and returns the task ID
  and reason; no treatment advice or invented clinical priorities;
- the statement that these are proposed operational sorting rules, not validated
  clinical priorities;
- the three open clinical questions, for an ER veterinarian to approve.

The "Action selection" bullet itself and every other line stay as they are. 4.13a
is not changed, not implemented and not marked final.

## Build steps

- [x] **Step 1 - record the proposal** - add the bullet described above to the Decisions section of `blueprint/build-plan.md`, directly after the "Action selection" bullet, and change nothing else. *Done when:* `git diff --check` is clean; `git diff --stat` shows one file with one added line; the new bullet contains "proposed", the three open questions and "not validated clinical priorities"; `4.13a` still reads "after the action-selection decision" and is still unticked.

## Verify

- `scripts/verify.ps1` (workflow scope: no application files change).
- No app check: nothing in the running app changes.
- The reviewer confirms the three open questions are stated clearly in the bullet
  (the PR will repeat them).

## Result

- **Prepared:** branch `fix/record-action-selection-decision`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-02, scope workflow (reused from 2026-11-02T14:53:20Z, fix/record-action-selection-decision @ 5d95605)
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
- **Step evidence:** `git diff --check` clean; the build-plan diff adds one line in Decisions; 4.13a is still unticked and reads "after the action-selection decision".
- **Check:** not needed; nothing in the running app changes.
- **Audit:** not needed (documentation only).
- **Follow-ups added to build plan:** none. 4.13a stays blocked until an ER veterinarian approves the proposed rule.
- **Deploy notes:** none.
- **Built differently from the spec:** the branch was first created as `docs/action-selection-decision` and renamed to the fix convention before the spec was written; nothing had been pushed.
