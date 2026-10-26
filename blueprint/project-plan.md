# Project Plan

> One of the two planning docs you own. It says why VetiFlow exists, who it is
> for, and what it must never do. The build plan says in what order things get
> built; each feature spec says how one item gets built. Change this file when a
> product decision changes, and note the decision in the build plan's Decisions
> section.

## 1. Problem - What problem are we solving?

In a veterinary emergency room, the state of every patient lives on a
whiteboard, in people's heads and in the practice software. Staff lose time
asking who is waiting, who is critical, which room is free and what happens
next. Owners in the waiting room get no updates and ask the front desk again
and again.

VetiFlow is a real-time ER board: every active case by stage, acuity and wait
time, updated on every open screen the moment anyone changes it. A separate,
private owner page tells each owner how their own pet is doing, in calm words.

## 2. Users - Who is this for?

- **Veterinarians.** Set acuity through triage, own treatment decisions, confirm
  AI drafts and handoffs.
- **Technicians.** Move cases between stages, record vitals and tasks, see their
  workload.
- **Managers.** See the whole board, rooms and team load; later, the audit log.
- **Pet owners.** Never see the staff board. They get a private page for their
  own pet only, with calm wording and no acuity, reached through a scoped,
  expiring link or sign-in.

Staff use shared clinic workstations, so sessions must lock quickly.

## 3. Features - What does the MVP need?

1. Live staff board: lanes by stage, cards with acuity, wait timer and next action.
2. Change a case's stage (drag and drop, and a keyboard menu) with live updates.
3. Case detail drawer: patient, owner, triage, vitals, tasks, timeline.
4. Patient and owner records with search; intake for a new or existing patient,
   with an unknown owner allowed.
5. Triage, vitals, staff and room assignment, tasks and blockers.
6. Owner communication log and clinician-approved owner updates.
7. Manual handoffs and discharge; case history and corrections.
8. Administration: staff, rooms and clinic settings.
9. Private owner page.
10. AI assistance: intake summary and handoff drafts, always marked unconfirmed
    until a clinician confirms. Every workflow works without AI.
11. Staff sign-in and roles before any real clinic data.

## 4. Data - What are we storing?

- `Patient` (name, species, breed, sex) and, from build plan 0.2, `Owner` with contact details.
- `EmergencyCase`: stage, status, current acuity, assigned doctor, technician and room, next action, arrival and discharge times.
- `TriageAssessment`: the history of acuity decisions. The case's current acuity comes from the latest one through `RecordTriage`.
- `VitalsRecord`: repeated vitals on a case. Recording them never changes acuity.
- `CaseTask`: tasks and blockers on a case.
- `CaseEvent`: the case timeline (stage changes and other events).
- `Handoff`: a handoff between staff and its acknowledgement.
- `AiSummary`: AI drafts and their confirmation.
- `StaffMember`, `Room`.
- Planned, by build-plan item: staff accounts (S.15), owner access links
  (S.8), owner contact log (6.4), owner updates (6.5), discharge outcome
  (6.2), clinic settings (9.3), audit log (8.1).

Rules that later features must keep:

- A patient has at most one active case, and a room holds at most one active
  case (`DischargedAt IS NULL`). Partial unique indexes enforce both.
- Enums are stored as text. Renaming a value needs a migration that updates
  stored rows.
- Deletes never cascade. Case history, assessments, AI output and handoffs are
  the audit trail.

## 5. Tech - What stack are we using?

- **ASP.NET Core on .NET 10** - REST API under `/api`, SignalR hub at `/hubs/cases`.
- **EF Core with Npgsql** - Postgres access and migrations.
- **PostgreSQL on Supabase** - the hosted database.
- **React 19, Vite, TypeScript, SCSS modules** - the client.
- **xUnit v3 with Testcontainers; Vitest with React Testing Library and MSW** - tests.
- **GitHub Actions** - CI on every PR.
- **An AI provider behind `IAiProvider`** - not chosen yet (build plan 5.1).

## 6. Monetize - How will this make money?

Not part of v1. Open question.

## 7. UI/UX - How should this look and feel?

- Staff board: dark top bar (logo, hospital and shift, stats), left icon nav,
  lanes by stage, cards with species icon, coloured acuity badge, large timer,
  staff name and next action. Build against the screenshots in
  `blueprint/reference/`.
- Acuity colours and labels: Critical, Urgent, High, Low, in that order.
- Calm, plain wording on the owner page. No acuity, no clinical shorthand.
- Accessible: keyboard alternative to drag and drop, `aria-live` for remote
  changes, AA contrast.
- Staff and owner display labels live in the client, separate from the API's
  enum values.

Routes:

- `/` - staff ER board
- owner page route - decided in build plan 6.3

## 8. Deployment - Where and how will this ship?

- **API:** Docker container on Render, running as the image's non-root `app`
  user (`USER $APP_UID`; `ServerImageTests` checks it).
- **Client:** Vercel, SPA routing.
- **Database:** Supabase Postgres. Render has no IPv6 and Supabase's direct
  host is IPv6-only, so Render's `ConnectionStrings__VetiFlowDatabase` must be
  the **session pooler** string (Supabase: Connect, Session pooler; port 5432,
  user `postgres.<project-ref>`).
- **Secrets and rotation:**
  - The database connection string is the only secret today. Locally it lives
    in user secrets (`ConnectionStrings:VetiFlowDatabase`); on Render it is
    `ConnectionStrings__VetiFlowDatabase`. Never in source or `appsettings*.json`.
  - `VITE_API_BASE_URL` on Vercel is public: every `VITE_` variable ends up in
    the browser bundle, so nothing secret goes in one.
  - `scripts/tests/secrets-config.tests.ps1` (run by Verify and CI) fails if a
    tracked `appsettings*.json` holds a connection string or password, if the
    client uses a `VITE_` variable not on its allowlist, or if an env file
    other than `.env.example` is tracked. GitHub secret scanning and push
    protection catch other secrets.
  - Rotate the database password when it may have been exposed or someone
    with access leaves: reset it in Supabase (Project Settings, Database),
    update `ConnectionStrings__VetiFlowDatabase` on Render and save (it
    redeploys), check `GET /api/health` is `healthy`, then update local user
    secrets.
- **CORS:** allowed browser origins come from `Cors:AllowedOrigins`.
  `appsettings.json` allows `https://vetiflow.vercel.app`, and
  `appsettings.Development.json` allows the Vite dev server
  `https://localhost:52540` instead. To change production, set
  `Cors__AllowedOrigins__0` (and `__1`, ...) on Render. Startup refuses an
  empty list, `*`, and anything but a bare `https://host[:port]` origin.
- **Behind Render's proxy:** the API takes the scheme and client address from
  `X-Forwarded-Proto` and `X-Forwarded-For`, trusting only the nearest proxy,
  so a client cannot spoof its address. Outside Development, HTTPS responses
  carry HSTS (ASP.NET Core defaults).
- **Startup database settings** (build plan S.1):
  `Database__MigrateOnStartup` and `Database__SeedDemoData`, both `false`
  unless set. `appsettings.Development.json` and the test host turn both on;
  Render sets neither.
- **Health check:** `GET /api/health`. 200 `healthy` when the database
  answers, 503 `unhealthy` when it does not. Render's health check depends on
  the route and these status codes.
- **CI:** every PR and every push to `main` runs `scripts/verify.ps1` in two
  jobs ("Server tests", "Client lint, build and tests"), plus "PR title" on
  PRs. The server tests include `ServerImageTests`, which builds
  `vetiflow.Server/Dockerfile` and starts the image as Render does (`PORT`
  set, Production), so a broken image fails CI before Render ever sees it.
- **Render:** Auto-Deploy is set to "After CI Checks Pass", so a merge to
  `main` deploys only once CI is green on the merge commit. Health Check Path
  is `/api/health`: a new deploy that does not answer `healthy` (database
  down, or migrations pending, see below) is marked failed, and the previous
  one keeps serving.
- **Vercel:** only `main` deploys (`git.deploymentEnabled` in
  `vetiflow.client/vercel.json`, held by a workflow test). There is no
  staging API, so a preview could only call production; previews come back
  when a staging API exists.
- **Rollback:**
  1. Render: Events, choose the last good deploy, Rollback. Rolling back code
     never undoes a migration. A migration that went wrong is fixed forward
     with a new one; there is no backward compatibility to keep.
  2. Vercel: Deployments, choose the last good production deployment, Instant
     Rollback (or Promote).
  3. Then revert the bad change on `main` through a PR, so the next
     auto-deploy does not ship it again.
- **Migrations in production** run as a deliberate deploy step, never by
  accident and never from a developer machine. With migrations pending and
  `Database__MigrateOnStartup` off, the app refuses to start and logs which
  migrations are missing; Render marks the deploy failed and keeps the
  previous build serving. When a merged change adds a migration:
  1. On Render, set `Database__MigrateOnStartup=true` (Environment).
  2. Deploy the commit (Manual Deploy, or the save triggers one).
  3. Check the deploy log for the applied migrations and `GET /api/health`
     for `healthy`.
  4. Set `Database__MigrateOnStartup` back to `false` (or delete it).

## 9. Usage model and constraints

- Internet-facing. Holds owner contact details and clinical notes.
- Staff are trusted only after sign-in, and only for their role. Owners are
  untrusted users and reach only their own pet's case.
- Deployed with demo data only, not in clinical use. Manual features may be
  built and shown on demo data first. Real clinic data only after build-plan
  milestones M1 (safe foundations), M3 (sign-in and roles) and the M7 launch
  gate. Until S.5 the API accepts unauthenticated writes, so it holds demo data
  only.
- One clinic at a time. Multi-clinic tenancy is not a requirement.
- AI output is a draft until a clinician confirms it. Owner contact details
  never go to the AI provider.
