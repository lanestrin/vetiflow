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

## How each item works

Each item goes through the loop described in `blueprint/context/ai-interaction.md`:
`/brief <id>` (optional) -> `/feature <id>` -> `/implement` -> `/audit` (when the
spec says required) -> `/check` -> `/complete` -> `/approve` -> you squash-merge.
The branch is the one listed on the item. Aim for a PR of a few hundred lines or
less.

## Decisions

- **Acuity scale:** decided, Critical / Urgent / High / Low. The rename from Stable is its own branch, `feature/acuity-high`.
- **Owners never see the staff board:** decided. Owners get a private page for their own pet only, with calm wording and no acuity. Staff and client labels live in the client.
- **AI table design** (before 5.1): keep `AiSummary` and `Handoff` separate, or merge them into one `AiGeneration` table.
- **Login provider** (before S.5): ASP.NET Core Identity in our own database, or an external provider such as Supabase Auth or Microsoft Entra.

## Phase 0: Data model foundation

- [x] **0.1** `feature/data-model-integrity`: real foreign keys, restrict deletes, partial unique indexes, enums stored as text, `PatientSex`, drop `Room.IsAvailable`, `RecordTriage`, `CaseTask`, migrate and seed on startup, richer seed [1–9]. Merged (PR #12). History: `history/features/0.1-data-model-integrity.md`.
- [ ] **0.2** `feature/owner-and-vitals`: `Owner` entity with contact details and communication status; repeated vitals (`VitalsRecord`, or several triage assessments per case); seed both.
- [ ] **0.3** `feature/acuity-high`: rename `Stable` to `High` in the enum, client types and seed, with a migration that updates existing rows.

## Phase 1: Deploy and CI

- [x] **1.1** `chore/workflow-setup`: Blueprint-style workflow: `CLAUDE.md`, `blueprint/` plans, context, history, `scripts/verify.ps1` and the `.claude/skills` commands. Done (history/features/1.1-workflow-setup.md).
- [x] **1.2** `feature/test-suite`: xUnit v3 test project with unit, API, database and migration tests against Testcontainers Postgres; Vitest, React Testing Library and MSW in the client. Merged (PR #13). History: `history/features/1.2-test-suite.md`.
- [x] **1.3** `feature/test-suite`: GitHub Actions runs server tests, client lint, build and tests on every PR and push to `main`. Merged with 1.2 (PR #13).
- [ ] **1.4** `fix/dependabot-alerts`: resolve any open alerts that remain after PR #13's `npm audit fix` (check brace-expansion, source-map-js, zod).
- [ ] **1.5** `docs/readme`: README with a screenshot, the live link and local setup.
- [ ] **1.6** `chore/ci-verify-script`: make CI call `scripts/verify.ps1` so CI and local checks can never drift apart.
- [ ] **1.7** `chore/release-notes`: `.github/release.yml` so GitHub's generated release notes group squash-merged commits by type (features, fixes, chores), plus a first tag.

## Phase S: Security foundations (before Phase 2)

The app isn't live yet, so security comes before the features that depend on knowing who the user is. Each item is its own branch.

- [ ] **S.1** `fix/startup-migrations`: migrating and seeding on startup are controlled by settings, off by default and on for local dev; production migrates as a deliberate deploy step.
- [ ] **S.2** `fix/stage-validation`: reject numeric and unknown enum values on the stage endpoint, and turn off integer enum parsing everywhere [10].
- [ ] **S.3** `fix/hosting-config`: CORS origins from configuration, forwarded headers behind Render, HSTS in production, Supabase session pooler [17, 18].
- [ ] **S.4** `fix/docker-nonroot`: run the container as a non-root user.
- [ ] **S.5** `feature/auth-login`: staff login (provider per the decision above), secure cookies or short-lived tokens, logout, CSRF protection if cookies are used; every API endpoint requires a signed-in user by default.
- [ ] **S.6** `feature/auth-roles`: roles (Veterinarian, Technician, Manager, Owner) and authorization policies, so for example only clinicians can set acuity or confirm AI output.
- [ ] **S.7** `feature/hub-authorization`: require sign-in on the SignalR hub, pass the token safely, and broadcast IDs only, with no patient data in hub messages.
- [ ] **S.8** `feature/owner-access-control`: owners can only see their own pet's case on the owner page (resource-based checks, no guessable links).
- [ ] **S.9** `feature/rate-limiting`: ASP.NET Core rate limiter on login, writes and AI endpoints [19].
- [ ] **S.10** `chore/secrets-handling`: connection strings and API keys only in user secrets and Render/Vercel environment variables, nothing secret in `VITE_` variables, secret scanning on, and a rotation note.
- [ ] **S.11** `chore/db-least-privilege`: the app connects with a database user that can't change the schema; a separate user runs migrations.
- [ ] **S.12** `feature/input-validation`: length and format limits on every request, ProblemDetails errors, no stack traces or internal details in production responses [13].
- [ ] **S.13** `fix/supabase-lockdown`: Supabase serves tables in `public` through its REST API with the anon key. Turn on row level security with no policies (or revoke the `anon` and `authenticated` grants) on every VetiFlow table.
- [ ] **S.14** `feature/session-timeout`: short idle timeout and a quick lock for shared ER workstations (after S.5).

## Phase 2: Live board you can change

- [ ] **2.1** `feature/stage-update-rules`: enforce allowed stage transitions (value validation is S.2), write a `StageChanged` event, ProblemDetails errors [10, 11, 13].
- [ ] **2.2** `feature/case-concurrency`: `xmin` concurrency token, return `409` with the current state [12].
- [ ] **2.3** `feature/board-query`: active cases only, sort by acuity then wait time, add doctor, technician, room, blockers and `LastUpdated` to the DTO [14–16].
- [ ] **2.4** `feature/tanstack-query`: move board fetching to TanStack Query, fix refetch races, keep showing the last good data on errors [22, 23].
- [ ] **2.5** `feature/live-connection-status`: retry forever, refetch on reconnect, Live / Reconnecting / Offline indicator [21].
- [ ] **2.6** `feature/drag-and-drop`: dnd-kit drag between lanes with optimistic update and rollback.
- [ ] **2.7** `feature/keyboard-stage-menu`: "Move to stage…" menu on each card, `aria-live` announcements for remote changes.
- [ ] **2.8** `feature/timer-escalation`: neutral, amber and red thresholds per acuity [24].
- [ ] **2.9** `chore/board-polish`: heading levels, page title, favicon, don't count discharged patients [25, 26].
- [ ] **2.10** `feature/app-shell`: dark top bar (logo, hospital and shift, stats) and left icon nav (after 2.1).
- [ ] **2.11** `feature/card-redesign`: restyle `CaseCard` to the mockup (species icon, coloured acuity badge, large timer, staff name, Next line).
- [ ] **2.12** `feature/dashboard-stats`: average triage time and open rooms in the top bar (`GET /api/dashboard/summary`).
- [ ] **2.13** `feature/activity-feed`: `GET /api/events`, the footer feed, new events pushed through SignalR.

## Phase 3: Case detail

- [ ] **3.1** `feature/case-detail-api`: `GET /api/cases/{id}` with patient, owner, triage, vitals, tasks and timeline.
- [ ] **3.2** `feature/case-detail-drawer`: the drawer UI, with raw intake notes above the AI summary.
- [ ] **3.3** `feature/card-details`: blocker chips, doctor and technician, and room on each card.

## Phase 4: Triage, assignment and rooms

- [ ] **4.1** `feature/case-intake`: create a new case.
- [ ] **4.2** `feature/triage-form`: record a triage assessment and set acuity through `RecordTriage` (clinicians only).
- [ ] **4.3** `feature/staff-room-assignment`: assign the doctor, technician and room.
- [ ] **4.4** `feature/case-tasks`: create and resolve tasks and blockers, overdue alerts.
- [ ] **4.5** `feature/side-panels`: room status and team workload panels, derived from case data.

## Phase 5: AI assistance

- [ ] **5.1** `feature/ai-provider`: `IAiProvider` interface with a real provider and a deterministic fake one for CI and demos.
- [ ] **5.2** `feature/ai-intake-summary`: JSON schema (summary, missing information, conflicts, urgency signals, no treatment advice), validation, retry once, store prompt version and model.
- [ ] **5.3** `feature/ai-review-ui`: "AI DRAFT, unconfirmed" badge, a confirm button, "Confirmed by … at …".
- [ ] **5.4** `feature/ai-resilience`: timeouts, manual fallback, "AI unavailable" state, rate limiting on AI endpoints.

## Phase 6: Handoffs and discharge

- [ ] **6.1** `feature/handoffs`: generate a handoff draft, edit, confirm, acknowledge.
- [ ] **6.2** `feature/discharge`: discharge flow that sets `DischargedAt` and frees the room.
- [ ] **6.3** `feature/owner-page`: the private owner page, using the client labels and only staff-confirmed owner notes (S.8 merges first).

## Phase 7: Quality and polish

- [ ] **7.1** `test/integration-tests`: Testcontainers Postgres tests for the API and constraints.
- [ ] **7.2** `test/playwright-sync`: two browsers, drag in one, assert the other updates.
- [ ] **7.3** `chore/openapi-client`: generate the TypeScript client from OpenAPI.
- [ ] **7.4** `feature/demo-mode`: demo banner, Reset demo button, scheduled reseed, rate limit on writes [19, 20].
- [ ] **7.5** `chore/logging`: structured logging with correlation IDs.
- [ ] **7.6** `chore/accessibility-pass`: AA contrast, keyboard and screen reader checks.
- [ ] **7.7** `docs/adrs`: ADRs in `docs/` (why SignalR, why Postgres, why no Redux).

## Phase 8: Pre-launch security gate

All of these must be done before VetiFlow goes live.

- [ ] **8.1** `feature/audit-log`: record who viewed or changed patient and owner data, and when; viewable by managers.
- [ ] **8.2** `feature/security-headers`: CSP, `X-Content-Type-Options`, `Referrer-Policy` and frame-ancestors on Vercel and the API.
- [ ] **8.3** `chore/log-redaction`: keep patient and owner details, tokens and connection strings out of logs.
- [ ] **8.4** `feature/ai-data-safety`: strip owner contact details before sending anything to the AI provider, treat intake notes as untrusted (prompt injection), use a provider setting that doesn't train on data, and limit how long AI inputs are stored.
- [ ] **8.5** `chore/privacy-data-handling`: synthetic data only in the demo, a retention policy, owner data export and delete, and a privacy notice.
- [ ] **8.6** `chore/backups`: Supabase backups or point-in-time recovery turned on, with a tested restore.
- [ ] **8.7** `chore/security-scanning`: Dependabot config and CodeQL in CI so new vulnerabilities show up on PRs.
- [ ] **8.8** `docs/security-review`: threat model, a pre-launch checklist, and a final review of auth, the hub and the owner page.
