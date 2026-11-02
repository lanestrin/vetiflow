# Fix: Simplify the My Patients dependency chain in the build plan

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/simplify-my-patients-path`
- **Audit:** not needed. This changes only the planning docs, with no application code, auth or data changes.

## The problem

`blueprint/build-plan.md` made My Patients (2.22a-d) wait on eight items (4.3a, S.5, S.6, 3.7a, 4.16a, 4.17a, 4.18a, 4.20a) and five decisions. Several of those are advanced clinical workflows that a first queue and read-only chart don't need. That conflicts with the person's "Avoid Overengineering" direction (2026-11-02): build the simplest working version first, reuse existing parts, and enforce only the dependencies that security, data integrity or function need. The open **Shared care** decision also blocked 4.3a, which is first in the new order.

## The fix

Planning text only, in `blueprint/build-plan.md`:

1. **New Decisions entry,** "Build the simplest working version first" (2026-11-02). It records:
   - the principles;
   - the safeguards that are never traded: patient safety, authentication and server-side authorization, data integrity and concurrency, audit history, accurate documentation, and keeping unverified information separate from confirmed;
   - the order: 4.3a → 4.13b → S.5/S.6 → My Patients 2.22a-d → advanced workflows incrementally.
2. **Shared care decided:** the primary technician is optional and a case without one shows "Not assigned". There's no shared-pool model or placeholder person. 4.3a and 4.3b are worded to match.
3. **Role queue rules:** a first-version default, to be confirmed in the 2.22a spec.
   - "Assigned to me" covers the attending vet or the assigned technician.
   - "All active" covers every active case.
   - Counts are distinct patients.
   - Shared-pool, cover, review and escalation counters come with their workflows.
4. **2.22a:** depends only on S.6 and 4.3a. 3.7a is dropped as a blocker, and 4.16a, 4.17a, 4.18a and 4.20a join the queue later instead of blocking it.
5. **2.22c:** a read-only vet chart from existing records (overview, tasks, timeline, discharge status). Later sections say "not available yet".
6. **4.13b:** comes after 4.3a. Priority and designation are set in the existing Tasks and due items dialog, and the location dropdown uses 4.3a.
7. **M3b intro:** a line summarising the shorter path.

**Must not break:**
- S.5 and S.6, which still gate My Patients, because that's security.
- Server-side authorization.
- Every item ID: nothing is renumbered.
- Ticked items.

## Build steps

- [x] **Step 1 - apply the planning changes** above to `blueprint/build-plan.md`.
  *Done when:* `git diff --check` is clean; `git diff` touches only `blueprint/build-plan.md` (plus this spec); no item ID is renamed or removed; and `/verify` passes its workflow checks with the server and client checks reported as Not needed.

## Verify

`scripts/verify.ps1` passes. This is a docs-only change, so only the workflow tests apply. No app behaviour changes, so there's nothing to `/check`.

## Result

- **Prepared:** branch `fix/simplify-my-patients-path`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-02, scope workflow (reused from 2026-11-02T16:14:18Z, fix/simplify-my-patients-path @ 482de58)
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
- **Step evidence:** `git diff --check` clean; only `blueprint/build-plan.md` changed; the changed item lines are 4.13b, 4.3a, 4.3b, 2.22a and 2.22c, all still unticked, with no ID renamed or removed. S.5 and S.6 remain prerequisites of My Patients.
- **Check:** not needed; nothing in the running app changes.
- **Audit:** not needed (documentation only).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none.
