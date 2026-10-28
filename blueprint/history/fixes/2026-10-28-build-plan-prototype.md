# Fix: Rebuild the build plan around the ER Command Center prototype

**Type:** Fix
**Status:** complete
**Branch:** `fix/build-plan-prototype`
**Audit:** not needed - planning docs and a design reference only; no application code, data or config.

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

The staff board now has a design to match: the ER Command Center prototype,
`blueprint/reference/vetiflow-er-dashboard.html` (added 2026-10-28). The plans
don't follow it:

- `blueprint/build-plan.md` plans stage lanes with drag and drop (2.1, 2.6,
  2.7), a drawer (3.2) and a separate shell and card redesign "needing a
  mockup" (2.10, 2.11). The prototype has acuity lanes, a side panel and an
  intake dialog.
- The prototype shows data nothing in the plan creates: case numbers, SpO₂,
  clinical tags, reassessment and client-update times, shift, door to doctor,
  and more.
- The plan is cluttered with about 40 finished items (the Done list, M1, M3a
  and done M2 lines), so the next real item is hard to find.
- `blueprint/project-plan.md` still says lanes by stage, drag and drop, and
  Critical / Urgent / High / Low.
- The prototype file isn't in git yet.

## The fix

Decided with you on 2026-10-28:

- three acuity levels, as in the prototype;
- stages changed through **Update status**, with no drag and drop;
- every field the prototype shows gets real data.

The edits, already made in the working tree:

- **`blueprint/build-plan.md`:**
  - **Rules:** the prototype is the design; each component is an `a`
    (back-end) item followed by its `b` (front-end) item; finished items are
    removed at clean-ups, with `blueprint/history/` keeping them.
  - **M2 rebuilt** as the prototype's components in build order: acuity, app
    shell, case numbers, patient flow board, search and filter, stats, heading
    and shift, patient overview panel, intake, vitals, next actions, Update
    status, reassessment and client updates, tags, care team, re-triage, pet
    parent contact, handoff, discharge, door to doctor, notifications and the
    Patients forms.
  - **Decisions:** updated with the three decisions above, plus open
    decisions for the items that need one (wait chip, age at intake,
    allergies and medications, shift, door to doctor, vital ranges,
    notifications).
  - **Done items removed.** 2.1, 2.6, 2.7 and 3.3 moved to Dropped with the
    reason.
  - **New items:** 8.14 (Render auto-deploy), S.10c (`vetiflow_app` cutover)
    and M4 for the rail's Team, Overview and Reports pages.
  - **IDs:** unstarted IDs are reused for the same component, and new items
    take the next free number. No started or finished ID changes meaning.
- **`blueprint/project-plan.md`:** features, users and UI sections now
  describe acuity lanes, Update status, the patient overview panel, the
  three-level acuity colours, the prototype as the staff design, and the
  `/records` route.
- **`blueprint/reference/README.md`:** lists the current references, with the
  prototype first.
- **`blueprint/reference/vetiflow-er-dashboard.html`:** added to git as the
  design reference.

It must not break:

- **Workflow tests:** `/status`, `/feature` and `/complete` keep reading the
  plan, because the item line format (`- [ ] **ID** \`branch\`: ...`) is
  unchanged.
- **History links:** no history file points at a removed line by line
  number.

## Build steps

- [x] **Step 1 - the plan edits** - the four files above. *Done when:* the
  build plan has no ticked items, every M2 component is an `a` item followed
  by its `b` item (or a single front-end item), every open decision names the
  item it blocks, and `scripts/verify.ps1` passes, including the workflow
  tests.

## Verify

- `scripts/verify.ps1`, with Workflow tests PASS.
- Read-through: `/status` names 0.4a as the next item, and
  `/brief 2.11a` finds its line and the wait chip decision.
- No app check: nothing in the running app changes.

## Result

- **Prepared:** branch `fix/build-plan-prototype`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-28 (reused; the run before it was fresh on this branch)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** 0 ticked items left in the build plan; the first open item is 0.4a; every M2 component is an a/b pair or a single front-end item (2.14); all 14 open decisions name the item they block.
- **Decisions recorded (with the person, 2026-10-28):** three acuity levels (Critical, Urgent, Stable); lanes by acuity, with stages changed through Update status (2.6 and 2.7 dropped, 2.1 merged into 4.9a); every field the prototype shows gets real data.
- **Beyond the spec:** the build plan's first rule says ticked items are removed at the next clean-up, rather than on completion, so `/complete` keeps working unchanged.
- **Check:** not run; nothing in the running app changes.
- **Audit:** not needed (planning docs and a design reference only).
- **Follow-ups:** the open decisions in the build plan; the first, the wait chip, is needed before 2.11a.
- **Deploy notes:** none.
