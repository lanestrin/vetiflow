# Fix: Reorder the build plan for the revised prototype

**Type:** Fix
**Status:** complete
**Branch:** `fix/build-plan-revised-prototype`
**Audit:** not needed - planning documents and the design reference only; no application code.

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

The ER Command Center prototype was revised on 2026-10-28 (the uncommitted
`blueprint/reference/vetiflow-er-dashboard.html` and the newer copy
`vetiflow-er-dashboard (3).html`). It adds things the build plan doesn't cover
and changes some it does:

- An **ER board | My patients** switch with a clinician workspace: My status
  (Busy, Available, At limit, Unavailable), my stats, "Assigned to me" cards,
  "My work queue" (reassessments, reviews and owner updates with due times) and
  "Workload & team".
- New intakes are **provisional**: the card shows **New**, a "<priority> ·
  provisional" tag and "Awaiting triage" until a clinician presses **Complete
  triage**.
- A **pain score** (0–10 with notes) recorded from the panel, with a meter.
- Clickable stat cards that filter the board, an **Incoming** filter button,
  and a door-to-doctor details dialog with **Show waiting patients**.

In the current order, several items would build data twice:

- 4.10a plans reassessment and client-update times as case columns, but My work
  queue treats them as tasks.
- Nothing stores "clinicians on the floor", which the heading (2.15a), Workload
  & team and the Team page (4.5) all need.
- 2.15b would build a disabled New intake button to rewire later, because
  intake (4.1) comes after it.
- The merged wait-chip rule (2.11a) says "New = no acuity", which never happens
  once intake sets a provisional priority. A separate fix corrects the code;
  this fix records the decision.

## The fix

Planning and reference only; no code changes.

1. **Reference:** the revised prototype replaces
   `blueprint/reference/vetiflow-er-dashboard.html`; the `(3)` copy is removed.
   `blueprint/reference/README.md` notes what the revision added.
2. **Decisions** (`build-plan.md`, Decided, 2026-10-28):
   - **New intakes are provisional:** the intake's priority sets the lane, the
     case waits in stage Incoming ("Awaiting triage"), and **Complete triage**
     confirms it.
   - **Wait chip (revised):** first match wins: still in Incoming → `new`;
     Critical → `stat`; ready for next step → `ready`; stage Recheck →
     `recheck`; otherwise minutes since arrival.
   - **Due items are tasks:** reassessment and client update are task types
     with a due time and assignee. The panel rows show the next open one, My
     work queue lists my open tasks, and Open actions counts them.
   - **On the floor = My status:** each clinician's status lives on the staff
     record; any status except Unavailable counts as on the floor. Shift hours
     stay a separate setting. This replaces the open decision "Shift and
     clinicians on floor" for the clinicians part.
   - **Pain score is its own record:** score 0–10, optional notes, when and who.
     Not a vital and not a tag.
   - **Stat cards filter the board:** in care (all), awaiting triage, critical;
     door to doctor opens its details.
3. **Build order** (M2):
   1. 2.11b board lanes and cards (adds the provisional tag and "Awaiting
      triage" on incoming cards).
   2. 4.1a/b New intake (moved up; still needs the age and allergies and
      medications decisions).
   3. 4.2a/b Triage, adding **Complete triage** (moved up).
   4. 2.12a/b stat cards with click-to-filter.
   5. 2.14 search and filter, adding the **Incoming** toggle.
   6. **New 2.21a/b** My status (availability).
   7. 2.15a/b heading, with a working New intake button and the shift chip from
      My status.
   8. 3.2a/b patient overview panel.
   9. 4.4a/b tasks, adding Reassessment and Client update types with due
      times; **4.10a/b move to Dropped** (merged into 4.4).
   10. 4.8a/b vitals: SpO₂, plus the pain score record, the panel meter and
       **Record score**.
   11. 4.9, 3.5, 4.3, 6.4, 6.1, 6.2 (order unchanged).
   12. 2.16a/b door to doctor, adding the details dialog and **Show waiting
       patients**.
   13. **New 2.22a/b** My patients workspace (after items 6, 9 and 10).
   14. 4.7, 2.17, 4.6c, 2.20.
4. **4.5 Team page** reads availability from My status (2.21).
5. **Project plan** section 7: mention the My patients workspace, provisional
   intake and the pain score meter.

## Build steps

- [x] **Step 1 - reference and plans** - replace the prototype, update the
  reference README, the Decisions (decided and open), the M2 order with 2.21
  and 2.22, 4.10 in Dropped, 4.5's line, and project plan section 7. *Done
  when:* `build-plan.md` lists M2 in the order above with no item lost (every
  unticked ID before the change is either still listed or in Dropped), the
  `(3)` copy is gone, and the workflow tests in `scripts/verify.ps1` pass.

## Verify

- Verify (workflow tests) passes.
- Read-through: every new item has an ID and branch, each `b` item follows its
  `a`, and every open decision names the item it blocks.

## Result

- **Prepared:** branch `fix/build-plan-revised-prototype`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-28 (reused from 2026-10-28T18:17:44Z, fix/build-plan-revised-prototype @ 2feb146; the full run passed in `/ready`)
  - PASS Workflow tests
  - PASS Server build
  - PASS Server tests
  - PASS Client lint
  - PASS Client build
  - PASS Client tests
- **Check:** not run (planning documents). The unticked build-plan IDs were compared before and after: only 4.10a and 4.10b left the list (now under Dropped, merged into 4.4), 2.21a/b and 2.22a/b were added, no duplicates. The revised prototype's stat cards were clicked in headless Chrome: each filters the board or opens the door-to-doctor details, with no script errors.
- **Audit:** not needed.
- **Follow-ups added to build plan:** 2.21a/b (My status) and 2.22a/b (My patients), as specified. The code change for the revised wait chip is a separate fix.
- **Deploy notes:** none.
