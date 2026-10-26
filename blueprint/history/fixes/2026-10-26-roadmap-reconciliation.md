# Fix: Reconcile the roadmap with the code

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/roadmap-reconciliation`
- **Audit:** not needed - planning docs only (`build-plan.md`, `project-plan.md`); no application code, config or data

## The problem

`blueprint/build-plan.md` no longer matches the code or the delivery goal.

**Current product state (from the repository on 2026-10-26):**

| State | Capability | Evidence |
| --- | --- | --- |
| End to end | Read-only staff board: lanes by stage, acuity badge, wait timer, status, next action, three counts | `Controllers/CasesController.cs` `GET /api/cases`, `routes/ErBoardPage.tsx`, `components/clinical/*` |
| End to end | Live refresh: any `caseUpdated` hub message refetches the board | `Hubs/CaseHub.cs`, `services/caseHub.ts`, `ErBoardPage.tsx` |
| End to end | Health check, safe startup (migrate and seed opt-in), CORS from config, proxy headers, HSTS, non-root image, RLS on every table, name-only enums | `HealthController.cs`, `Data/DatabaseStartup.cs`, `Hosting/CorsOrigins.cs`, `Program.cs`, `Dockerfile`, migrations |
| End to end | CI runs Verify; image build test; PR title check; Dependabot for GitHub Actions | `.github/workflows/*`, `scripts/verify.ps1`, `ServerImageTests.cs`, `.github/dependabot.yml` |
| Partial | Stage change: `PATCH /api/cases/{id}/stage` validates the value and broadcasts, but no UI calls it, there are no transition rules, no `CaseEvent` is written and nobody is recorded | `CasesController.UpdateStage`, `casesApi.updateCaseStage` (used only in tests) |
| Partial | Board list returns discharged cases too, sorted by arrival only, and the count includes them | `GetCases` has no `DischargedAt` filter; `ErBoardStatusBar.tsx` |
| Partial | Live connection: `withAutomaticReconnect()` (gives up after four tries), no refetch on reconnect, initial failure only logged to the console, any load error replaces the whole board | `caseHub.ts`, `ErBoardPage.tsx` |
| Model only | Owner, communication status, repeated triage and vitals, tasks and blockers with due times, timeline events, handoffs with acknowledgement, AI summaries with review, staff, rooms | `Models/*`, seeded by `DbSeeder.cs`; no endpoint or screen uses them |
| Missing | Sign-in, roles, hub auth, owner access, intake, patient and owner records, case detail, triage and vitals entry, assignment, tasks, handoffs, discharge, case history, administration, owner page, AI, audit log, monitoring, backups | no code |
| Not in the model | Login accounts, owner contact history, staff-approved owner updates, discharge outcome, owner access links, clinic settings, audit log | no entity |
| Unverified (hosting) | Render env vars and Auto-Deploy, Vercel settings, Supabase pooler, backups and whether the production database holds seeded demo data, open Dependabot alerts on GitHub | live settings outside the repo |

Note: until S.5, the deployed API accepts unauthenticated writes (the stage
endpoint today). It must hold demo data only.

**Problems in the roadmap:**

1. **Order.** Phase S says it comes "before Phase 2", so the board waits on
   sign-in, which waits on the open login-provider decision. Security has to
   gate *real clinic data*, not manual features on demo data.
2. **Gaps.** No items for patient and owner records and search, vitals entry,
   status and next-action editing, owner communication log, staff-approved
   owner updates, case history, corrections, administration, account
   lifecycle, board search, monitoring, a separate demo environment, an
   end-to-end journey test, operator docs or a pilot.
3. **AI coupling.** 6.1 handoffs "generate a draft", which makes the manual
   handoff depend on AI.
4. **Duplication and stale text.** 7.1 (Testcontainers integration tests) was
   delivered by 1.2. 2.1 and S.12 both claim ProblemDetails [13]. 8.7 says
   "Dependabot config" though it exists for Actions. 2.4 is named after a
   library. "How each item works" still says
   `/implement -> /audit (when the spec says required)`.
5. **Undecided product choices** hidden inside items (transition rules,
   discharge outcomes, owner access method, timer thresholds).
6. **Missing design input.** 2.10 and 2.11 build against a mockup, but
   `blueprint/reference/` holds only its README.

## The fix

Rewrite `build-plan.md` into delivery order, keeping every ID, branch, tick
and history reference, and clarify `project-plan.md` where requirements
changed. No second backlog and no new workflow.

### build-plan.md

**Rules for this list:** add two rules: file order is build order (`/feature`
with no ID takes the first unticked item); a dropped item keeps its line with
no checkbox and says why.

**How each item works:** replace the stale loop with
`/feature <id>` -> "OK and build" (`/ready`) -> `/complete` -> `/approve` -> you
squash-merge, `/audit` only when you ask (link to `ai-interaction.md`). Add
"Every item that adds a write": records a `CaseEvent` where the case timeline
needs it, records the staff member (from sign-in once S.5 lands), returns
ProblemDetails (S.12), turns a conflict into a clear `409`, disables the
control while saving, and adds an authorization test once S.6 lands.

**Decisions:** keep both open ones. Add:
- *Decided 2026-10-26:* security gates real clinic data, not manual features
  on demo data.
- *Open:* stage transition rules (before 2.1); case status vs blockers - set
  by staff, derived, or both (before 4.9); discharge outcomes, and who may
  correct or reopen a discharged case (before 6.2, 6.7); duplicate patients -
  warn only or merge (before 4.7); owner access - expiring link or owner
  sign-in, and link lifetime (before S.8); timer thresholds per acuity, from
  the clinic (before 2.8); pilot scope - clinic, workstations, go-live and
  fallback to the whiteboard (before 8.12).

**Sections in this order** (each starts with one line on its purpose and
dependencies):

- **Done:** every ticked item, lines unchanged (0.1-0.3, 1.1-1.3, 1.6, 1.8,
  S.1-S.3, S.13).
- **M1 Safe foundations** (now): S.12 (owns ProblemDetails), S.10, 1.4.
- **M2 Manual staff journey on demo data** - intake -> detail -> triage ->
  assignment -> progression -> discharge: 2.9 (adds `noindex` meta and a
  disallow-all `robots.txt`), 2.3, new 4.6, 4.1 split into new 4.1a/4.1b,
  3.1, 3.2, 4.2, new 4.8, 4.3 (adds room-conflict `409`), 2.1 (drops
  ProblemDetails), 2.6, 2.7, new 4.9, 6.2 (adds outcome), new 4.7.
- **M3 Sign-in and roles** (needs the login-provider decision; may start in
  parallel with M2 once decided; must finish before real data): S.5 (fills the
  existing `*ByStaffId` fields from the signed-in user), new S.15, S.6, S.7,
  S.14, S.9.
- **M4 Clinical support:** 4.4, new 6.4, 6.1 (manual), 3.3, 2.8, 4.5.
- **M5 Administration, history and reliable live behaviour:** new 9.1, 9.2,
  9.3, new 6.6, new 6.7, 2.4 (renamed), 2.5 (adds stale-data indicator and
  initial-failure state), 2.2 (adds duplicate-submit guard on writes), 2.13,
  new 2.14, 2.10, 2.11 (both need the mockup in `blueprint/reference/`).
- **M6 Private owner experience:** S.8 (adds expiry, revoke, expired-link
  page), new 6.5, 6.3.
- **M7 Launch gate and pilot** (all before real clinic data): new 8.10, 7.4
  (runs in the demo environment), 8.1, 8.2 (adds `X-Robots-Tag: noindex`),
  8.3, 7.5, 8.5, 8.6, new 8.9, 8.7 (reworded), 7.6 (adds tablet width), 7.2,
  new 7.8, 1.5, new 8.11, 8.8, new 8.12.
- **M8 AI assistance** (after M7; never required by a manual workflow): 5.1,
  5.2, 5.3, 5.4, new 5.5, 8.4 (before AI touches real data).
- **Later:** 2.12, 1.7, 7.3, 7.7.
- **Dropped:** 7.1, covered by 1.2 (`history/features/1.2-test-suite.md`).

**New items** (next free ID in their series):
- **4.6** `feature/patient-owner-records`: create, edit and search patients and owners; a patient may have no owner (stray, owner unknown).
- **4.1a** `feature/case-intake-api`: create a case for a new or existing patient; validation; one active case per patient returns `409` with the active case; `Arrived` event; correct intake fields.
- **4.1b** `feature/case-intake-form`: intake form with patient search or new patient, unknown owner allowed, opened from the board.
- **4.7** `feature/duplicate-patients`: warn on likely duplicates (same name, species and owner) at intake; merge only if the decision says so.
- **4.8** `feature/vitals-entry`: record vitals through `RecordVitals`, history in the drawer with time and recorder; never changes acuity.
- **4.9** `feature/case-status-next-action`: set status and next action from the card or drawer, `StatusChanged` event.
- **S.15** `feature/staff-accounts`: invite a staff member, link the account to a `StaffMember`, deactivate (blocks sign-in at once), account recovery per the provider.
- **6.4** `feature/owner-contact-log`: record each owner contact (when, how, by whom, outcome); keeps `OwnerUpdateStatus` and `LastOwnerUpdateAt` in step; contact details never on the board.
- **6.5** `feature/owner-updates`: staff write an owner-facing update; a clinician approves it before the owner page can show it.
- **6.6** `feature/case-history`: list and search discharged cases; open one read-only in the drawer.
- **6.7** `feature/case-corrections`: correct a discharged case or reopen it, per the decision, with a `CaseEvent` for each change.
- **9.1** `feature/staff-admin`: managers add, edit and deactivate staff members and roles.
- **9.2** `feature/room-admin`: managers add, rename and retire rooms; a room with an active case can't be retired.
- **9.3** `feature/clinic-settings`: clinic name and timer thresholds per acuity (feeds 2.8).
- **2.14** `feature/board-search-filter`: search by patient or owner name, filter by acuity, stage and "assigned to me".
- **8.9** `chore/monitoring`: uptime alert on `/api/health`, error alerting, log retention.
- **8.10** `chore/demo-environment`: separate Render service and Supabase project with demo data only; production holds real data only; Vercel previews point at demo.
- **7.8** `test/playwright-journey`: intake -> triage -> assignment -> stage moves -> discharge in a browser.
- **8.11** `docs/operator-runbook`: deploy, migrate, rollback, restore, rotate secrets, onboard and offboard staff, incident contacts.
- **8.12** `chore/pilot-readiness`: pilot checklist, staff training notes, feedback route, whiteboard fallback.
- **5.5** `feature/ai-handoff-draft`: AI drafts the handoff text for 6.1; staff edit and confirm; manual handoff keeps working without it.

**Rewordings** (unstarted items only; branch renames allowed):
- **2.1:** transition rules per the decision, `StageChanged` event; ProblemDetails moves to S.12.
- **2.4** `feature/board-data-loading`: no refetch races, keep the last good data on errors, loading and error states inside the board (TanStack Query is the planned choice).
- **6.1:** manual handoff - write, list open tasks and blockers as outstanding work, choose the recipient, acknowledge; AI drafting is 5.5.
- **6.2:** discharge with outcome, `DischargedAt`, room freed (derived), `Discharged` event, case leaves the board.
- **8.7:** extend Dependabot to npm and NuGet, add CodeQL.
- Phase-S intro line ("before Phase 2") goes; M3's line replaces it.

### project-plan.md

- **Section 3 (MVP):** add patient and owner records with search,
  owner communication log and approved owner updates, case history and
  corrections, administration (staff, rooms, clinic settings). Say handoffs
  are manual first and AI never blocks a workflow.
- **Section 4 (Data):** list `VitalsRecord`, and name the planned additions by
  item: owner contact log (6.4), owner updates (6.5), discharge outcome
  (6.2), owner access links (S.8), staff accounts (S.15), clinic settings
  (9.3), audit log (8.1).
- **Section 9:** replace "Security foundations come before features that
  depend on knowing who the user is" with: deployed with demo data only and
  not in clinical use; manual features may be built on demo data first; real
  clinic data only after M1, M3 and the M7 gate; until S.5 the API accepts
  unauthenticated writes, so it holds demo data only.

Must not change: completed lines and their history references, existing IDs,
history files, `current-feature.md` workflow, skills, application code.

## Build steps

- [x] **Step 1 - build plan.** Rewrite `blueprint/build-plan.md` as above.
  *Done when:* every ID from the old file is still present exactly once
  (ticked lines byte-identical), each new ID is unique, every item sits in
  exactly one section, the decisions list includes the new open ones, and no
  text describes a required audit.
- [x] **Step 2 - project plan.** Update sections 3, 4 and 9 of
  `blueprint/project-plan.md` as above.
  *Done when:* those sections say what is listed above and nothing else in the
  file changed.

## Verify

- A one-off ID check (script in the scratchpad, not committed): every ID in
  `git show main:blueprint/build-plan.md` appears once in the new file, ticked
  lines are unchanged, no ID is duplicated.
- `scripts/verify.ps1 -ReuseIfCurrent` passes (the hard rule; it reruns in
  full only if its fingerprint counts these files).
- Nothing to observe in the app; `/check` is skipped.

## Result

- **Prepared:** branch `fix/roadmap-reconciliation`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T20:00:31Z, fix/roadmap-reconciliation @ 782aed4)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **ID check:** every one of the 68 IDs in `main`'s build plan appears once; 21 new IDs (2.14, 4.1a, 4.1b, 4.6-4.9, 5.5, 6.4-6.7, 7.8, 8.9-8.12, 9.1-9.3, S.15); no duplicates; ticked lines byte-identical; no text describes a required audit.
- **Beyond the spec:** project plan section 4 also splits the `AiSummary` and `Handoff` line, since handoffs are now manual first.
- **Check:** not run - docs only, nothing to observe in the app
- **Audit:** not needed
- **Follow-ups added to build plan:** none beyond this fix's own items
- **Deploy notes:** none
