# Build Plan

> One of the two planning docs you own. Each line is one work item: one branch,
> one spec, one small PR. Numbers in brackets refer to the issues in the
> "VetiFlow code review and remaining work" doc.

## Rules for this list

- IDs are stable. Never renumber an item once work on it has started, because
  its spec in `blueprint/history/features/` uses that ID.
- Add new items at the end of the right phase with the next free number. When an
  item is too big for one PR, `/feature` proposes lettered sub-items (2.3a, 2.3b).
- `/complete` ticks the item and adds `Done (history/features/<file>)`. The
  squash-merge commit on `main` carries the PR number (`(#<n>)`), so nothing is
  edited after the merge.
- Bugs and small unplanned changes do not go here. They use `/fix` and land in
  `blueprint/history/fixes/`.
- File order is build order. The sections below are milestones in delivery
  order, and an ID keeps the number of the phase it was first planned in.
  `/feature` with no ID takes the first unticked item.
- A dropped item keeps its line with no checkbox and says why.

## How each item works

Each item goes through the loop described in `blueprint/context/ai-interaction.md`:
`/brief <id>` (optional) -> `/feature <id>` -> "OK and build" (`/ready`) ->
`/complete` -> `/approve` -> you squash-merge. `/audit` runs only when you ask
for it. The branch is the one listed on the item. Aim for a PR of a few hundred
lines or less.

Every item that adds a write also:

- records a `CaseEvent` when the change belongs on the case timeline;
- records the staff member who made it (from sign-in once S.5 lands);
- returns ProblemDetails errors (S.12) and turns a conflict into a clear `409`;
- disables the control while saving, so a double click can't submit twice;
- adds an authorization test once S.6 lands.

## Decisions

- **Acuity scale:** decided, Critical / Urgent / High / Low. The rename from Stable is its own branch, `feature/acuity-high`.
- **Owners never see the staff board:** decided. Owners get a private page for their own pet only, with calm wording and no acuity. Staff and client labels live in the client.
- **Security gates real clinic data, not features:** decided 2026-10-26. Manual features are built and shown on demo data first. No real clinic data until M1, M3 and the M7 gate are done.
- **AI table design** (before 5.1): keep `AiSummary` and `Handoff` separate, or merge them into one `AiGeneration` table.
- **Login provider** (before S.5): ASP.NET Core Identity in our own database, or an external provider such as Supabase Auth or Microsoft Entra.
- **Sign-in proof of concept:** decided 2026-10-26. A free local simulation (M3a): accounts in our own database, the framework's built-in password hashing and bearer tokens, and a fixed demo phone code with no text sent. No paid authentication, email or SMS service. The login-provider and owner-access decisions stay open for production.
- **Stage transition rules** (before 2.1): which stage moves are allowed, for example any move forward and back only to Triage or Recheck.
- **Case status and blockers** (before 4.9): whether staff set the status, it is derived from open blockers, or both.
- **Discharge outcomes and corrections** (before 6.2 and 6.7): the outcome list (for example home, transferred, admitted, deceased), and who may correct or reopen a discharged case.
- **Duplicate patients** (before 4.7): warn only, or also merge.
- **Owner access** (before S.8): an expiring link or owner sign-in, and how long a link lasts.
- **Timer thresholds** (before 2.8): amber and red minutes per acuity, from the clinic.
- **Pilot scope** (before 8.12): which clinic, how many workstations, the go-live date and the fallback to the whiteboard.

## Done

- [x] **0.1** `feature/data-model-integrity`: real foreign keys, restrict deletes, partial unique indexes, enums stored as text, `PatientSex`, drop `Room.IsAvailable`, `RecordTriage`, `CaseTask`, migrate and seed on startup, richer seed [1–9]. Merged (PR #12). History: `history/features/0.1-data-model-integrity.md`.
- [x] **0.2** `feature/owner-and-vitals`: `Owner` entity with contact details and communication status; repeated vitals (`VitalsRecord`, or several triage assessments per case); seed both. Split into (both done):
  - [x] **0.2a** `feature/owner`: `Owner` entity, optional `Patient.OwnerId`, per-case owner update status (`OwnerUpdateStatus`, `LastOwnerUpdateAt`), seeded owners. Done (history/features/0.2a-owner.md).
  - [x] **0.2b** `feature/repeated-vitals`: `VitalsRecord` per case; a migration moves today's vitals off `TriageAssessment`, which keeps acuity and intake notes. Done (history/features/0.2b-repeated-vitals.md).
- [x] **0.3** `feature/acuity-high`: rename `Stable` to `High` in the enum, client types and seed, with a migration that updates existing rows. Done (history/features/0.3-acuity-high.md).
- [x] **1.1** `chore/workflow-setup`: Blueprint-style workflow: `CLAUDE.md`, `blueprint/` plans, context, history, `scripts/verify.ps1` and the `.claude/skills` commands. Done (history/features/1.1-workflow-setup.md).
- [x] **1.2** `feature/test-suite`: xUnit v3 test project with unit, API, database and migration tests against Testcontainers Postgres; Vitest, React Testing Library and MSW in the client. Merged (PR #13). History: `history/features/1.2-test-suite.md`.
- [x] **1.3** `feature/test-suite`: GitHub Actions runs server tests, client lint, build and tests on every PR and push to `main`. Merged with 1.2 (PR #13).
- [x] **1.6** `chore/ci-verify-script`: make CI call `scripts/verify.ps1` so CI and local checks can never drift apart. Done (history/features/1.6-ci-verify-script.md).
- [x] **1.8** `chore/deploy-pipeline`: Docker image build in CI, Render auto-deploy only after CI passes, Vercel previews that never point at the production API, a Render health check, and a rollback note. Done (history/features/1.8-deploy-pipeline.md).
- [x] **S.1** `fix/startup-migrations`: migrating and seeding on startup are controlled by settings, off by default and on for local dev; production migrates as a deliberate deploy step. Done (history/features/S.1-startup-migrations.md).
- [x] **S.2** `fix/stage-validation`: reject numeric and unknown enum values on the stage endpoint, and turn off integer enum parsing everywhere [10]. Done (history/features/S.2-stage-validation.md).
- [x] **S.3** `fix/hosting-config`: CORS origins from configuration, forwarded headers behind Render, HSTS in production, Supabase session pooler [17, 18], and the container runs as a non-root user (merged in from S.4 on 2026-10-26). Done (history/features/S.3-hosting-config.md).
- [x] **S.13** `fix/supabase-lockdown`: Supabase serves tables in `public` through its REST API with the anon key. Turn on row level security with no policies (or revoke the `anon` and `authenticated` grants) on every VetiFlow table. Done (history/features/S.13-supabase-lockdown.md).

## M1: Safe foundations

Needs no decisions and no sign-in. Every write in M2 relies on S.12's errors.

- [x] **S.12** `feature/input-validation`: length and format limits on every request, ProblemDetails errors, no stack traces or internal details in production responses [13]. Done (history/features/S.12-input-validation.md).
- [x] **S.10** `chore/secrets-handling`: connection strings and API keys only in user secrets and Render/Vercel environment variables, nothing secret in `VITE_` variables, secret scanning on, and a rotation note; the app connects with a database user that can't change the schema, and a separate user runs migrations (merged in from S.11 on 2026-10-26). Split into (both done):
  - [x] **S.10a** `chore/secrets-handling`: a workflow test that keeps connection strings out of `appsettings*.json` and allows only known, non-secret `VITE_` variables; a secrets and rotation section in the project plan; GitHub secret scanning and push protection on. Done (history/features/S.10a-secrets-handling.md).
  - [x] **S.10b** `chore/least-privilege-db`: an app role that can read and write rows but not change the schema, RLS policies for it, migrations through a separate privileged connection used only during a migration deploy, and the Supabase and Render steps. Done (history/features/S.10b-least-privilege-db.md).
- [x] **1.4** `fix/dependabot-alerts`: resolve any open alerts that remain after PR #13's `npm audit fix` (check brace-expansion, source-map-js, zod). Done (history/features/1.4-dependabot-alerts.md).

## M3a: Sign-in proof of concept (demo)

A free, local simulation of sign-in for both roles, built against
`blueprint/reference/vetiflow-login-mock.html`. It needs no decision. It was
moved ahead of M2 on 2026-10-27 so stakeholders can see sign-in first. It is
not production authentication: details, acceptance criteria and limits are in
project plan section 10.

- [x] **S.16** `feature/demo-accounts`: `Account` entity and migration (RLS and `AppRoleAccess.Grant`) linking each sign-in to one `StaffMember` or one `Owner`, password hashing with the framework's `PasswordHasher`, and the two seeded demo accounts, with database tests. Done (history/features/S.16-demo-accounts.md).
- [x] **S.17** `feature/demo-email-sign-in`: `POST /api/auth/email` (email and password to a bearer token), `GET /api/auth/me` (name and experience), and the `TeamMember` policy, ready for S.18. Done (history/features/S.17-demo-email-sign-in.md).
- [x] **S.18** `feature/sign-in-screen`: `/sign-in` with the Email option to the mockup, the success panel, routing to `/er` or `/pet-parent`, a minimal pet parent home, sign out, route guards and the session-ended state; the board and stage endpoints require a hospital team member (`401` signed out, `403` for a pet parent), moved here from S.17 so the deployed board never breaks between the two. Split into (all done):
  - [x] **S.18a** `feature/sign-in-screen`: the `/sign-in` page to the mockup (Email tab; Phone tab marked as coming in S.19), demo banner and sample accounts, every no-match, field and unavailable message, the Forgot password and Help placeholders, the success panel continuing to `/er` or a simple `/pet-parent` welcome, and the token kept in `sessionStorage`. Done (history/features/S.18a-sign-in-screen.md).
  - [x] **S.18b** `feature/session-and-board-lock`: the board and stage endpoints require a hospital team member (`401` signed out, `403` for a pet parent); the client sends the token on board requests; route guards (`/` goes home by role, signed out goes to `/sign-in`, a pet parent on `/er` goes to `/pet-parent`); "Signed in as ... (demo)" with Sign out on the board; and the session-ended state. Done (history/features/S.18b-session-and-board-lock.md).
  - [x] **S.18c** `feature/pet-parent-home`: `GET /api/pet-parent/pets` (owner from the token, no IDs in the URL) and the `/pet-parent` page listing the account's own pets and whether each is in care, in calm wording with no acuity. Done (history/features/S.18c-pet-parent-home.md).
- [x] **S.19** `feature/demo-phone-sign-in`: `POST /api/auth/phone/start` and `POST /api/auth/phone/verify` with the fixed code `123456` only while `DemoSignIn:Enabled` is on, no text sent, and the Phone option on the screen. Done (history/features/S.19-demo-phone-sign-in.md).
- [ ] **S.20** `feature/landing-sign-in`: the stakeholders' new sign-in landing design (`blueprint/reference/landing-page/`, added 2026-10-27, top priority) on the existing `/sign-in` page, keeping every sign-in behaviour from S.18 and S.19. Split into:
  - [x] **S.20a** `feature/landing-sign-in-layout`: the full-width background art, the paw brand, the three-benefit story, the restyled sign-in card (tab icons, field icons, show-password), and the tablet and phone layouts with the art as a hero. Done (history/features/S.20a-landing-sign-in-layout.md).
  - [ ] **S.20b** `feature/landing-emergency-bar`: the "Need emergency care?" bar with Call Now and View Directions; until a real hospital number and address exist, both open a demo notice instead of dialling or opening maps.

## M2: Manual staff journey on demo data

Intake -> case detail -> triage -> assignment -> progression -> discharge, with
no AI. Until M3 the API accepts unauthenticated writes, so the deployed app
holds demo data only.

- [x] **2.9** `chore/board-polish`: heading levels, page title, favicon, and keep every page out of search engines (`noindex` meta, disallow-all `robots.txt`) [25, 26]. Done (history/features/2.9-board-polish.md).
- [x] **2.3** `feature/board-query`: active cases only, so discharged patients leave the board and its counts (moved here from 2.9), sort by acuity then wait time, add doctor, technician, room, blockers and `LastUpdated` to the DTO [14–16]. Done (history/features/2.3-board-query.md).
- [ ] **4.6** `feature/patient-owner-records`: create, edit and search patients and owners; a patient may have no owner (a stray, or the owner is not known yet).
- [ ] **4.1** `feature/case-intake`: create a new case. Split into:
  - [ ] **4.1a** `feature/case-intake-api`: create a case for a new or existing patient, with validation; a second active case for the same patient returns `409` naming the active case; writes `Arrived`; intake fields can be corrected.
  - [ ] **4.1b** `feature/case-intake-form`: intake form opened from the board, with patient search or a new patient, and an unknown owner allowed.
- [ ] **3.1** `feature/case-detail-api`: `GET /api/cases/{id}` with patient, owner, triage, vitals, tasks and timeline.
- [ ] **3.2** `feature/case-detail-drawer`: the drawer UI, with raw intake notes above the AI summary.
- [ ] **4.2** `feature/triage-form`: record a triage assessment and set acuity through `RecordTriage` (clinicians only).
- [ ] **4.8** `feature/vitals-entry`: record vitals through `RecordVitals`, with the history in the drawer showing time and recorder; never changes acuity.
- [ ] **4.3** `feature/staff-room-assignment`: assign the doctor, technician and room; a room already holding an active case returns `409` naming that case.
- [ ] **2.1** `feature/stage-update-rules`: enforce allowed stage transitions per the decision (value validation is S.2, ProblemDetails is S.12), write a `StageChanged` event [10, 11].
- [ ] **2.6** `feature/drag-and-drop`: dnd-kit drag between lanes with optimistic update and rollback.
- [ ] **2.7** `feature/keyboard-stage-menu`: "Move to stage…" menu on each card, `aria-live` announcements for remote changes.
- [ ] **4.9** `feature/case-status-next-action`: set status and next action from the card or drawer, writing `StatusChanged`.
- [ ] **6.2** `feature/discharge`: discharge with an outcome, set `DischargedAt`, the room frees itself (it is derived), write `Discharged`, and the case leaves the board.
- [ ] **4.7** `feature/duplicate-patients`: warn on likely duplicates (same name, species and owner) at intake; merge only if the decision says so.

## M3: Sign-in and roles

Needs the login-provider decision. Once decided it can run alongside M2. Must
be done before real clinic data.

- [ ] **S.5** `feature/auth-login`: staff login (provider per the decision above, building on or replacing the M3a proof of concept), secure cookies or short-lived tokens, logout, CSRF protection if cookies are used; every API endpoint requires a signed-in user by default, and writes fill the existing `*ByStaffId` fields from the signed-in user.
- [ ] **S.15** `feature/staff-accounts`: invite a staff member, link the account to a `StaffMember`, deactivate (blocks sign-in at once), and account recovery per the provider.
- [ ] **S.6** `feature/auth-roles`: roles (Veterinarian, Technician, Manager, Owner) and authorization policies, so for example only clinicians can set acuity or confirm AI output.
- [ ] **S.7** `feature/hub-authorization`: require sign-in on the SignalR hub, pass the token safely, and broadcast IDs only, with no patient data in hub messages.
- [ ] **S.14** `feature/session-timeout`: short idle timeout and a quick lock for shared ER workstations (after S.5).
- [ ] **S.9** `feature/rate-limiting`: ASP.NET Core rate limiter on login, writes and AI endpoints [19].

## M4: Clinical support

Tasks, communication and handoffs around the journey in M2.

- [ ] **4.4** `feature/case-tasks`: create and resolve tasks and blockers, overdue alerts.
- [ ] **6.4** `feature/owner-contact-log`: record each owner contact (when, how, by whom, outcome), keeping `OwnerUpdateStatus` and `LastOwnerUpdateAt` in step; contact details never reach the board.
- [ ] **6.1** `feature/handoffs`: manual handoff: write it, list open tasks and blockers as outstanding work, choose the recipient, acknowledge. AI drafting is 5.5.
- [ ] **3.3** `feature/card-details`: blocker chips, doctor and technician, and room on each card.
- [ ] **2.8** `feature/timer-escalation`: neutral, amber and red thresholds per acuity [24].
- [ ] **4.5** `feature/side-panels`: room status and team workload panels, derived from case data.

## M5: Administration, history and reliable live behaviour

- [ ] **9.1** `feature/staff-admin`: managers add, edit and deactivate staff members and their roles.
- [ ] **9.2** `feature/room-admin`: managers add, rename and retire rooms; a room with an active case can't be retired.
- [ ] **9.3** `feature/clinic-settings`: clinic name and timer thresholds per acuity (feeds 2.8).
- [ ] **6.6** `feature/case-history`: list and search discharged cases, and open one read-only in the drawer.
- [ ] **6.7** `feature/case-corrections`: correct or reopen a discharged case per the decision, with a `CaseEvent` for each change.
- [ ] **2.4** `feature/board-data-loading`: no refetch races, keep showing the last good data on errors, loading and error states inside the board (TanStack Query is the planned choice) [22, 23].
- [ ] **2.5** `feature/live-connection-status`: retry forever, refetch on reconnect, Live / Reconnecting / Offline indicator, a "last updated" time when data may be stale, and a clear state when the first connection fails [21].
- [ ] **2.2** `feature/case-concurrency`: `xmin` concurrency token, return `409` with the current state, and the client shows the conflict and the current values [12].
- [ ] **2.13** `feature/activity-feed`: `GET /api/events`, the footer feed, new events pushed through SignalR.
- [ ] **2.14** `feature/board-search-filter`: search by patient or owner name, filter by acuity, stage and "assigned to me".
- [ ] **2.10** `feature/app-shell`: dark top bar (logo, hospital and shift, stats) and left icon nav (after 2.1). Needs the mockup in `blueprint/reference/`.
- [ ] **2.11** `feature/card-redesign`: restyle `CaseCard` to the mockup (species icon, coloured acuity badge, large timer, staff name, Next line). Needs the mockup in `blueprint/reference/`.

## M6: Private owner experience

- [ ] **S.8** `feature/owner-access-control`: owners can only see their own pet's case on the owner page (resource-based checks, no guessable links); access expires and staff can revoke it, with a clear expired-link page. Replaces the demo pet parent sign-in (S.18, S.19) for production.
- [ ] **6.5** `feature/owner-updates`: staff write an owner-facing update, and a clinician approves it before the owner page can show it.
- [ ] **6.3** `feature/owner-page`: the private owner page, using the client labels and only staff-confirmed owner notes (S.8 merges first). Replaces the minimal demo pet parent home (S.18).

## M7: Launch gate and pilot

All of these must be done before VetiFlow holds real clinic data.

- [ ] **8.10** `chore/demo-environment`: a separate Render service and Supabase project with demo data only, so production holds real data only; Vercel previews point at demo. Demo sign-in (`DemoSignIn:Enabled`, the demo accounts) exists only in the demo environment.
- [ ] **7.4** `feature/demo-mode`: demo banner, Reset demo button, scheduled reseed, rate limit on writes, in the demo environment only [19, 20].
- [ ] **8.1** `feature/audit-log`: record who viewed or changed patient and owner data, and when; viewable by managers.
- [ ] **8.2** `feature/security-headers`: CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors and `X-Robots-Tag: noindex` on Vercel and the API.
- [ ] **8.3** `chore/log-redaction`: keep patient and owner details, tokens and connection strings out of logs.
- [ ] **7.5** `chore/logging`: structured logging with correlation IDs.
- [ ] **8.5** `chore/privacy-data-handling`: synthetic data only in the demo, a retention policy, owner data export and delete, and a privacy notice.
- [ ] **8.13** `chore/revoke-app-delete`: once the back-end schema is final, revoke `DELETE` from the `vetiflow_app` role on every table except where a feature needs it (owner data deletion, 8.5), with a test that the role can't delete elsewhere. S.10b granted it for now (decided 2026-10-26).
- [ ] **8.6** `chore/backups`: Supabase backups or point-in-time recovery turned on, with a tested restore.
- [ ] **8.9** `chore/monitoring`: uptime alert on `/api/health`, error alerting and log retention.
- [ ] **8.7** `chore/security-scanning`: extend Dependabot from GitHub Actions to npm and NuGet, so new vulnerabilities show up on PRs. CodeQL default setup is already on (seen 2026-10-26, S.10a); keep it on.
- [ ] **7.6** `chore/accessibility-pass`: AA contrast, keyboard and screen reader checks, and layouts that work at tablet width.
- [ ] **7.2** `test/playwright-sync`: two browsers, drag in one, assert the other updates.
- [ ] **7.8** `test/playwright-journey`: intake -> triage -> assignment -> stage moves -> discharge in a browser.
- [ ] **1.5** `docs/readme`: README with a screenshot, the live link and local setup.
- [ ] **8.11** `docs/operator-runbook`: deploy, migrate, roll back, restore, rotate secrets, onboard and offboard staff, incident contacts.
- [ ] **8.8** `docs/security-review`: threat model, a pre-launch checklist, and a final review of auth, the hub and the owner page.
- [ ] **8.12** `chore/pilot-readiness`: pilot checklist, staff training notes, a feedback route and the whiteboard fallback.

## M8: AI assistance

After M7. Every workflow keeps working without AI.

- [ ] **5.1** `feature/ai-provider`: `IAiProvider` interface with a real provider and a deterministic fake one for CI and demos.
- [ ] **5.2** `feature/ai-intake-summary`: JSON schema (summary, missing information, conflicts, urgency signals, no treatment advice), validation, retry once, store prompt version and model.
- [ ] **5.3** `feature/ai-review-ui`: "AI DRAFT, unconfirmed" badge, a confirm button, "Confirmed by … at …".
- [ ] **5.4** `feature/ai-resilience`: timeouts, manual fallback, "AI unavailable" state, rate limiting on AI endpoints.
- [ ] **5.5** `feature/ai-handoff-draft`: AI drafts the handoff text for 6.1; staff edit and confirm it.
- [ ] **8.4** `feature/ai-data-safety`: strip owner contact details before sending anything to the AI provider, treat intake notes as untrusted (prompt injection), use a provider setting that doesn't train on data, and limit how long AI inputs are stored. Before AI touches real data.

## Later

- [ ] **2.12** `feature/dashboard-stats`: average triage time and open rooms in the top bar (`GET /api/dashboard/summary`).
- [ ] **1.7** `chore/release-notes`: clean up PR descriptions and release notes.
  Use the filled `landing-pr.md` body for PRs; the manual GitHub path must
  clearly replace the auto-filled body rather than append commit text above
  empty template sections. Keep descriptions concise and omit unused optional
  sections. Add `.github/release.yml` to group merged PRs by labels (features,
  fixes, maintenance), with a consistent way to assign labels from the PR type;
  prepare the first release/tag. Improve existing descriptions where needed,
  without rewriting Git history.
- [ ] **7.3** `chore/openapi-client`: generate the TypeScript client from OpenAPI.
- [ ] **7.7** `docs/adrs`: ADRs in `docs/` (why SignalR, why Postgres, why no Redux).

## Dropped

- **7.1** `test/integration-tests`: Testcontainers Postgres tests for the API and constraints. Dropped: delivered by 1.2 (history/features/1.2-test-suite.md); new items add their own API and database tests.
