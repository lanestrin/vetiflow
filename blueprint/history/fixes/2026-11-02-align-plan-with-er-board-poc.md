# Fix: Align the plan and product rules with the ER board prototype

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/align-plan-with-er-board-poc`
- **Audit:** not needed. Planning and reference docs only; no application code, auth or data changes.

## The problem

The person replaced the old page packages with one consolidated prototype. In the working tree on `main`, these folders are deleted:

- `blueprint/reference/patient-overview/`
- `blueprint/reference/vet-my-patient/`
- `blueprint/reference/technician-my-patient/`
- `blueprint/reference/patient-history/`
- `VetiFlow_Patient_History_Access_Recommendations.md`

In their place, `blueprint/reference/er-board-poc/` is added: `VetiFlow-ER-Prototype.html` and `VetiFlow-Product-Rules.md`.

The docs still point at the removed files and still describe the old design:

- `blueprint/build-plan.md` lines 23-30, 261 and 510 name the deleted folders and files.
- `blueprint/project-plan.md` section 7 (lines 148-165) names them too, and so does `blueprint/reference/README.md`.
- The "Board lanes" decision (2026-10-28) says acuity lanes. The prototype uses a table.
- No build-plan items cover the layout gaps between the app and the prototype:
  - the table board;
  - the patient header with four tabs;
  - the compact stats strip and in-board toolbar;
  - the tablet drawer and phone bottom bar;
  - the demo role switch;
  - assignments at intake.
- `VetiFlow-Product-Rules.md` contradicts five of the person's 2026-11-02 decisions:
  - inline stage and location dropdowns;
  - no Team destination;
  - reduced navigation;
  - an editable complaint;
  - an unlabelled role switch.

## The fix

Docs only. No item is ticked, renamed or renumbered.

### 1. Commit the reference swap

The deletions and the new `er-board-poc/` folder go on this branch.

### 2. Build-plan Decisions (`blueprint/build-plan.md`)

1. **Rules paragraph (lines 22-30).** The ER source becomes `reference/er-board-poc/`. `VetiFlow-Product-Rules.md` holds the requirements, and `VetiFlow-ER-Prototype.html` guides visual hierarchy and the shared patient record. It is a behavioural guide, not pixel-exact. The person's decisions take precedence over the prototype where they conflict. The separate My Patients packages were consolidated into the product rules on 2026-11-02.
2. **New decision: "Board layout"** (2026-11-02, by the person):
   - Desktop shows a table with Patient, Acuity, Care stage and Care team columns. Phones show compact patient cards.
   - Acuity stays visible as a text pill and can be filtered.
   - This supersedes the 2026-10-28 "Board lanes" decision, which is marked superseded and kept for history.
3. **New decision: "Patient header quick edits"** (2026-11-02):
   - The patient header shows the current care stage and location as buttons.
   - The buttons open the small modals shipped in 4.3b. There are no inline dropdowns.
   - This amends the "Patient Overview quick edits" decision, which keeps the complaint read-only. The prototype's complaint Edit action is not built.
4. **New decision: "Demo role switch"** (2026-11-02):
   - An app-wide Veterinarian / Technician switch labelled "Demo role — simulated access", for development and demos.
   - It changes the controls shown and the board's My patients filter.
   - It keeps the selected patient and the shared demo data.
   - It is independent of sign-in: the signed-in account does not change, and no account linking or account-to-role mapping is needed yet.
   - It is not authorization. Real permissions stay with S.6, and 3.7b's "no demo role dropdown as an authorization mechanism" still holds.
5. **New decision: "Navigation"** (2026-11-02):
   - The app keeps Overview, ER board, Patients, Team, Reports and Settings.
   - Phones use a bottom bar, with an overflow menu for destinations that don't fit.
   - The prototype's reduced navigation does not apply.
6. **New decision: "Assignment order"** (2026-11-02):
   - Assign the primary technician first when possible, then the attending veterinarian.
   - This is the default order, not a requirement: either may come first in an emergency, and neither blocks care.
   - Technicians are assigned to patients, never permanently paired with a doctor.
   - Tech and Vet show the same way in both role views, with an explicit "Unassigned".
   - Switching roles never changes what a column means.
   - The "New intakes are provisional" decision is amended so intake may record these assignments. The case still waits in stage Incoming until Complete triage.
7. **Updated existing decisions:**
   - "ER Overview scope": the three quick-access drawers become the Clinical, Orders & Medications and Timeline tabs (3.2c).
   - "My Patients role designs received": the source is now the consolidated product rules.
8. **"Build the simplest working version first" order:** 4.13b is followed by the new alignment items in order (2.25, 3.2c, 3.2d, 2.26, 2.27, 2.28, 4.1c), then S.5/S.6 and 2.22a-d.

### 3. Build-plan items

1. **4.13b:** drop "Current Location sits beneath it; its dropdown is delivered by 4.3b". 3.2c moves location and stage to the header. Add "styled as the prototype's Next care action block".
2. **New section** "ER board prototype alignment (2026-11-02, `reference/er-board-poc/`)", placed directly after 4.13b's section. 4.13e (deferred phase 2) moves below the new section, so `/feature` with no ID takes the alignment items next. Its text is unchanged.
   - **2.25** `feature/board-table`: the board as a table: Patient (species icon, name, breed and age), Acuity pill, Care stage, and Care team (Tech, then Vet, each "Unassigned" when missing). Selected-row state, keyboard selection, live updates. At phone width each row becomes a compact card. Replaces the acuity lanes and lane tabs. Client only: the list already returns both assignments.
   - **3.2c** `feature/patient-record-tabs`:
     - A fixed patient header: "Patient record" kicker, name with acuity pill, meta and case number, stage and location buttons opening the 4.3b modals, and the allergy line.
     - Four tabs (Overview, Clinical, Orders & Medications, Timeline) with arrow-key tablist behaviour. A new selection always opens on Overview.
     - The existing Clinical, Medications and Timeline review content moves into the tabs, and the record shortcut tiles and drawers are removed.
     - View Patient History (4.21c) stays reachable. Client only.
   - **3.2d** `feature/overview-tab`: the Overview tab in the prototype's order:
     - latest vitals with their measured time and "+ Record vitals";
     - the Next care action (4.13b);
     - Care team & safety (Technician, then Veterinarian, then allergies), with "Assign me" through the 4.3a endpoint;
     - the presenting complaint, read-only;
     - a save-state line naming who last updated the case and when.
     Honest missing states throughout. Client only.
   - **2.26** `feature/board-toolbar`:
     - A compact stats strip: In care, Awaiting triage, Critical, and Critical without vet. The last counts critical cases with no attending veterinarian, worked out from the list and replacing the Door to doctor card. 2.16b brings door to doctor back.
     - All patients / My patients scope; My patients is active only once 2.28 lands.
     - In-board search, an Unassigned toggle (either assignment missing) and Priority ↓/↑.
     - Filters for acuity, staff, "No technician assigned" and "No veterinarian assigned", added to the existing Filter menu.
     - A footer count. The spec decides whether pagination is needed. Client only.
   - **2.27** `feature/responsive-er-layout`:
     - Desktop keeps the board and panel side by side.
     - At 1100 px and below, the panel is a right-hand drawer over a backdrop, with close, Escape and focus return.
     - At 700 px and below, the panel is full screen and the rail becomes a bottom bar with an overflow menu for the six destinations, replacing the hamburger menu from 2.23.
     - Touch-sized controls. No horizontal page scroll.
   - **2.28** `feature/demo-role-switch`:
     - The "Demo role — simulated access" switch from the decision, in the shell.
     - Fictional demo identities: Jordan Lee (Veterinarian) and a seeded technician from 2.24, named in the spec.
     - It drives My patients (Vet: attending veterinarian; Tech: primary technician) and the role-specific controls the app already has, per product rules section 6. Attending-vet assignment is view-only as Technician.
     - It keeps the selection and is remembered per browser as a convenience. The server is unchanged.
   - **4.1c** `feature/intake-assignments`: a "Patient assignments" fieldset in the intake dialog, with Primary technician first and Attending veterinarian (optional), both defaulting to Unassigned. Saved through the existing 4.3a assignment endpoint after the case is created, so a failed assignment leaves the case created and says so. No new API unless the spec finds one is needed.
3. **2.16b:** "the stat card" becomes "the stats strip's door-to-doctor figure".
4. **Line 261 (M2 intro):** follow `reference/er-board-poc/`.
5. **Line 510:** note that the cited recommendations file has since been removed and that the outcome is in the 4.21a-d history.

### 4. Product rules (`blueprint/reference/er-board-poc/VetiFlow-Product-Rules.md`)

- A short "Decisions for the VetiFlow app (2026-11-02)" note at the top, saying these take precedence over the standalone prototype.
- **Section 3:** a table on desktop and cards on phones. Assignment filters stay on the board, but the app keeps its Team destination (who is on the floor and their workload, 4.5).
- **Section 4:** stage and location show as header buttons opening small modals. The complaint is read-only, with no edit action.
- **Section 5:** the switch label is "Demo role — simulated access". It is independent of sign-in, leaves the signed-in account unchanged, and needs no account linking yet. Real authorization is S.6.
- **Section 14:** phones use a bottom bar with overflow covering the app's six destinations.
- **Section 2:** the assignment rules are unchanged. One line confirms that role switching never changes a column's meaning.

### 5. Reference pointers

- `blueprint/reference/er-board-poc/README.md` (new):
  - the files and their source precedence (person's decisions, then product rules, then prototype);
  - a requirement-to-build-ID map (2.25, 2.26, 2.27, 2.28, 3.2c, 3.2d, 4.1c, 4.13b, plus the M3b items for Clinical, Orders, review requests, handoff and discharge);
  - what is deferred.
- `blueprint/reference/README.md`: replace the three removed entries with the ER board prototype entry.
- `blueprint/project-plan.md` section 7: point to `reference/er-board-poc/` and summarise the layout: table, header with tabs, drawer and bottom bar, demo role switch. The roles' chart sections stay as the 2.22 scope.

### Must not break

- Item IDs, ticked items and completed history files are not rewritten.
- S.5 and S.6 still gate My Patients 2.22a-d and real data.
- The demo role switch is never described as authorization.
- The 4.3b quick-edit modals and server checks stay as shipped.

## Build steps

- [x] **Step 1 - apply the docs changes** above, keeping the reference-folder swap in the branch.
  *Done when:*
  - `git diff --check` is clean.
  - The diff touches only `blueprint/` docs, plus the deleted reference files and the new `er-board-poc/` folder.
  - No item ID is renamed or removed.
  - `grep` finds no live reference to `patient-overview/`, `vet-my-patient`, `technician-my-patient` or `patient-history/` outside `blueprint/history/`, except the dated note at line 510.
  - `/verify` passes its workflow checks, with the server and client checks reported as Not needed.

## Verify

`scripts/verify.ps1` passes. This is a docs-only change, so only the workflow tests apply. Nothing changes in the running app, so there's no `/check`.

## Result

- **Prepared:** branch `fix/align-plan-with-er-board-poc`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-02, scope workflow (reused from 2026-11-02T21:11:53Z, fix/align-plan-with-er-board-poc @ 8ee2844)
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
- **Step evidence:** `git diff --check` clean; only `blueprint/` files changed (four docs edited, the old reference packages deleted, `er-board-poc/` added with a new README); no item ID removed or renamed (added 2.25, 2.26, 2.27, 2.28, 3.2c, 3.2d, 4.1c); ticked items unchanged at 52. Remaining mentions of the removed folders: the dated note on the visit-history re-plan, and the new README naming the packages it replaces.
- **Check:** not run; nothing in the running app changes.
- **Audit:** not needed (documentation only).
- **Follow-ups added to build plan:** none. For the 2.25 spec: decide whether the wait chip (STAT / New / minutes) stays in the table's Patient cell.
- **Deploy notes:** none.
