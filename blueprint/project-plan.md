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

VetiFlow is a real-time ER board: every active case by acuity, with its stage
and wait time, updated on every open screen the moment anyone changes it. A separate,
private owner page tells each owner how their own pet is doing, in calm words.

The ER Overview is a shared summary of the last documented encounter state,
not a claim of continuous clinical observation. The separate My Patients
workspaces have supplied veterinarian and technician requirements/prototypes
(2026-10-30). Their implementation shares one encounter record and is staged
behind the applicable identity, permission, clinical-policy and reliability work.

## 2. Users - Who is this for?

- **Veterinarians.** Set acuity through triage, own treatment decisions, confirm
  AI drafts and handoffs.
- **Technicians.** Update a case's stage and status, record vitals and tasks,
  see their workload.
- **Managers.** See the whole board, rooms and team load; later, the audit log.
- **Reception/client services.** See permitted operational status, approved
  client-facing updates and the appropriate clinician contact. Raw medical
  notes and preliminary diagnoses require explicit access; a staff label or
  role dropdown never grants it. Assistants/supervisors follow the approved
  role/action matrix rather than being treated as identical clinical users.
- **Pet owners.** Never see the staff board. They get a private page for their
  own pet only, with calm wording and no acuity, reached through a scoped,
  expiring link or sign-in. In the sign-in demo (section 10) they are "pet
  parents" and sign in with a demo account; production access follows build
  plan S.8.

Staff use shared clinic workstations, so sessions must lock quickly.

## 3. Features - What does the MVP need?

1. Live staff board (the ER Command Center): lanes by acuity, cards with stage,
   wait and care team, and a stats row.
2. Change a case's stage and status through Update status, with live updates.
3. Compact Patient Overview: identity/acuity, complaint, stage/location,
   documented priority/reassessment, latest vitals, safety/care team and
   approved client communication; Clinical, Medications and Timeline open
   focused review views instead of permanently expanding the panel.
4. Patient and owner records with search; intake for a new or existing patient,
   with an unknown owner allowed.
5. Shared triage, observations, assignments, tasks and blockers, with
   role-specific documentation chiefly in My Patients. Veterinarians document
   exam/plan, authorized orders, reviews and medical discharge decisions;
   technicians document observations, nursing care, authorized administrations,
   review/escalation requests and discharge preparation. Preserve existing
   working entry paths through an explicit cutover.
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
- Planned, by build-plan item: `Account` for the sign-in demo (S.16,
  section 10), staff accounts (S.15), owner access links
  (S.8), owner contact log (6.4), owner updates (6.5), discharge outcome
  (6.2), clinic settings (9.3), audit log (8.1).
- New ER requirements (2026-10-30) expose shared-data gaps, not implemented
  fields: separate measured/event and entry times (4.11), structured allergy
  verification and source (4.12), documented action priority/review and task
  accountability (4.13), and approved communication with author/approver
  metadata (6.4/6.5).
- The supplied role designs add planned shared contracts, not implemented
  tables: secure clinical drafts/signed note versions (4.15), review requests
  (4.16), urgent escalation (4.17), order drafts/authorized versions (4.18),
  reconciliation and medication administration (4.19), diagnostics/result
  interpretation (4.20), accepted temporary coverage (6.1c) and post-departure
  follow-up responsibility (6.8). Extend existing EmergencyCase, CaseTask,
  Handoff and identity structures where appropriate; the documents' conceptual
  Encounter/StaffUser names do not require duplicate per-page entities.

Rules that later features must keep:

- A patient has at most one active case, and a room holds at most one active
  case (`DischargedAt IS NULL`). Partial unique indexes enforce both.
- Enums are stored as text. Renaming a value needs a migration that updates
  stored rows.
- Deletes never cascade. Case history, assessments, AI output and handoffs are
  the audit trail.
- Existing RecordedAt/CreatedAt values are entry times unless a contract
  explicitly records an event time. Historical unknown measured times stay
  unknown; do not backfill entry time as a confirmed measurement.
- Allergy/medication text and missing values do not establish verified
  negatives. Preserve documented allergy, verified no known allergies,
  unknown/unverified and not recorded as distinct states in the planned model.
- Medical clearance is not physical departure. The future outcome model must
  keep census queries, room occupancy and active-case indexes consistent with
  explicitly documented departure/admission/transfer/death outcomes.
- Shared-role read responses require server-side field filtering. Reception
  and owners never receive raw clinical notes merely because the UI hides them.
- Persist clinical drafts on the server with approved visibility, retention,
  recovery and version-conflict rules. Do not use browser storage for clinical
  text. A delayed autosave must capture its encounter/input before navigation;
  autosave, acknowledgment and signing are separate operations.
- Clinical note/order signing identifies an authenticated actor and immutable
  version, with additive corrections/history. A technician request or browser
  button is not authorization. Administrations reference the patient's active
  verified authorized order/version, and preserve performer versus entry actor.
- A completed task, received message, reviewed result, accepted handoff and
  resolved concern are distinct facts. Escalations/results remain visible and
  owned independently of task completion, including follow-up after departure.

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

- ER Board / Patient Overview requirements now come from
  `blueprint/reference/patient-overview/VETIFLOW_ER_OVERVIEW_SPECIFICATION.md`
  (2026-10-30). Its `VetiFlow_ER_Overview_Shared_Status_POC.html` is a behavioral proof
  of concept, not a pixel-perfect specification or a design for other pages.
  Preserve the existing design system and working acuity board, provisional
  intake, stats, Filter/Priority and selection behavior while implementing
  the new hierarchy incrementally. Test realistic panel widths, tablet/phone
  layouts and enlarged text rather than copying tiny prototype labels.
- The compact Overview shows the eight responsibilities in the requirements:
  identity/acuity, complaint, stage/location, documented next action, numeric
  vitals with meaningful times, allergy/care-team context, approved client
  communication and Clinical/Medications/Timeline quick access. Only one
  focused review drawer is open at once, safely bound to the selected patient.
- The two My Patients packages are
  `blueprint/reference/vet-my-patient/` and
  `blueprint/reference/technician-my-patient/`. Both use one Patient Queue and
  a wider selected chart, three distinct-patient metric filters, neutral white
  active cards with a thin teal outline, and acuity badges beside names. No
  extra attention sidebar, fourth draft metric or staff productivity ranking.
- Share header/navigation/components and canonical data, while exposing the
  veterinarian's Clinical overview, Exam & plan, Orders, Tasks & reviews,
  Timeline and Discharge; and the technician's Care overview, Vitals &
  observations, Care tasks, Medications, Vet review requests, Handoff &
  escalation, Timeline and Discharge prep. Server policies govern available
  data/actions; role-specific rendering alone is not authorization.
- Keep ER Board / My Patients navigation visible. Standalone POCs disable the
  sibling link; the application activates normal navigation only as the role
  views are implemented and authorized. Legacy ER workspace HTML and hidden
  pain controls are not implementation instructions.
  No generic pain slider or permanently expanded full task list/timeline in
  the compact Overview. Existing clinical data/history is retained and entry
  workflows are moved only through an approved, usable replacement.
- Use last documented state and source, with honest Not recorded, Unknown /
  not verified, Not assigned and Not scheduled states. Do not invent a next
  treatment, equate task completion with clinical resolution, use demo vital
  ranges as approved alerts, or turn undocumented contact into "not contacted."
  Reception's approved note is distinct from internal clinical material.
- Each future page gets a separate requirements/prototype folder and a
  requirement-to-item mapping. `build-plan.md` remains the single ordered
  roadmap for shared dependencies; `current-feature.md` holds one PR's spec.
  Page designs do not create independent patient/task/permission models.
- Dashboard presentation update (2026-10-29, heading revised 2026-11-01): the
  clinic name is a teal eyebrow above the "ER Command Center" h1, as in the
  prototype. Use teal
  focus outlines on light surfaces, 16 px patient names, 14 px main content,
  13 px metadata and at least 12 px compact labels, expressed in rem.
- Custom focus outlines throughout the application use 1px via the shared
  `--focus-outline-width` token (requested 2026-10-29). Keep visible keyboard
  focus and the existing contrasting colours on light and dark surfaces.
- Application text previously set to font weight 800 uses 700 (requested
  2026-10-30); retain the other weights and use 700 for new bold headings.
- The landing emergency footer is compact: reduced padding and badge, with
  information/actions sharing a row when they fit and wrapping on narrow
  screens. It stays in normal flow on phones, tablets and short windows so
  it does not cover sign-in controls. Keep both demo actions and the full
  emergency guidance visible (requested 2026-10-30).
- Acuity colours and labels: Critical (red), Urgent (amber), Stable (teal), in
  that order (three levels, decided 2026-10-28; 0.4).
- Calm, plain wording on the owner page. No acuity, no clinical shorthand.
- Responsive and accessible: phone, tablet and desktop layouts; visible
  non-colour cues for acuity and status; everything works by keyboard;
  appropriate live announcements and WCAG 2.2 AA as the target. Follow
  "Responsive and accessible design" in `context/coding-standards.md`.
- Staff and owner display labels live in the client, separate from the API's
  enum values.

Routes:

- `/` - goes to the signed-in user's home, or `/sign-in` (from S.18)
- `/sign-in` - the sign-in screen (section 10)
- `/er` - the ER Command Center, hospital team members only

- `/records` - Patients (search and records), hospital team members only
- `/pet-parent` - the pet parent home: minimal in the demo (S.18), replaced by
  the owner page (6.3, final route decided there)

### Optional portfolio Security Lab

The 2026-10-30 `blueprint/reference/security-poc/` package defines a small
development/test-only proof of server-enforced permissions and safe security
events over fictional single-hospital data. S.21a-e can be prioritized after
the active Clinical drawer work, before the larger clinical workspaces, using
the existing authentication/domain stack where appropriate. It has separate
operator access and navigation, and no production test-execution/event routes.
Its simulated identity selector is not authentication, and a fictional order
authorization is not clinical medication authority. The app's production
identity, complete clinical-role matrix, audit and launch gates remain separate.

## 8. Deployment - Where and how will this ship?

- **API:** Docker container on Render, running as the image's non-root `app`
  user (`USER $APP_UID`; `ServerImageTests` checks it).
- **Client:** Vercel, SPA routing.
- **Database:** Supabase Postgres. Render has no IPv6 and Supabase's direct
  host is IPv6-only, so Render's `ConnectionStrings__VetiFlowDatabase` must be
  the **session pooler** string (Supabase: Connect, Session pooler; port 5432).
- **Database users** (build plan S.10b):
  - The API connects as `vetiflow_app` (pooler user
    `vetiflow_app.<project-ref>`). It reads and writes rows in every table
    through one RLS policy each, but owns no table, so it can't create, alter
    or drop anything or write migration history. `AddAppRole` creates it
    without a password. `DELETE` is granted for now; 8.13 revokes it.
  - Migrations run as `postgres` (pooler user `postgres.<project-ref>`, the
    tables' owner) through `ConnectionStrings__VetiFlowMigrations`, which is
    set on Render only during a migration deploy. Locally and in tests, with
    no migration string, the app's own connection migrates.
  - Supabase's `anon` and `authenticated` roles have no policy and read
    nothing.
  - **One-time cutover** (after S.10b merges):
    1. Render: set `Database__MigrateOnStartup=true` and
       `ConnectionStrings__VetiFlowMigrations` to the current `postgres`
       pooler string; save, so the deploy applies `AddAppRole`.
    2. Supabase SQL editor: `ALTER ROLE vetiflow_app WITH LOGIN PASSWORD
       '<new, generated>';` then check that `SELECT has_schema_privilege(
       'vetiflow_app', 'public', 'CREATE');` returns `false`.
    3. Render: set `ConnectionStrings__VetiFlowDatabase` to the pooler string
       with user `vetiflow_app.<project-ref>` and that password; delete
       `ConnectionStrings__VetiFlowMigrations` and
       `Database__MigrateOnStartup`; save.
    4. Check `GET /api/health` is `healthy`, the board loads and a stage
       change saves.
- **Secrets and rotation:**
  - The database connection strings are the only secrets today. Locally the
    app's lives in user secrets (`ConnectionStrings:VetiFlowDatabase`); on
    Render it is `ConnectionStrings__VetiFlowDatabase` (the `vetiflow_app`
    user). `ConnectionStrings__VetiFlowMigrations` (the `postgres` user) is on
    Render only during a migration deploy. Never in source or
    `appsettings*.json`.
  - `VITE_API_BASE_URL` on Vercel is public: every `VITE_` variable ends up in
    the browser bundle, so nothing secret goes in one.
  - `scripts/tests/secrets-config.tests.ps1` (run by Verify and CI) fails if a
    tracked `appsettings*.json` holds a connection string or password, if the
    client uses a `VITE_` variable not on its allowlist, or if an env file
    other than `.env.example` is tracked. GitHub secret scanning and push
    protection catch other secrets.
  - Rotate a database password when it may have been exposed or someone
    with access leaves. The app's: in the Supabase SQL editor
    `ALTER ROLE vetiflow_app WITH PASSWORD '<new, generated>';`, update
    `ConnectionStrings__VetiFlowDatabase` on Render and save (it redeploys),
    and check `GET /api/health` is `healthy`. The `postgres` password: reset
    it in Supabase (Project Settings, Database); it is only needed for the
    next migration deploy. Update local user secrets if they used either.
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
  1. On Render, set `Database__MigrateOnStartup=true` and
     `ConnectionStrings__VetiFlowMigrations` to the `postgres` pooler string
     (Environment).
  2. Deploy the commit (Manual Deploy, or the save triggers one).
  3. Check the deploy log for the applied migrations and `GET /api/health`
     for `healthy`.
  4. Delete both settings. Without the migration string, a migration attempt
     runs as `vetiflow_app`, is refused, and the deploy fails safely.

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

## 10. Sign-in proof of concept (demo)

A free, local demo of sign-in for both kinds of user (completed S.16 to
S.19), built against `blueprint/reference/login-poc/vetiflow-login-mock.html`. It is
not production authentication; the limits are listed at the end.

### Approach

- **No paid service.** Accounts live in our own Postgres. Passwords are hashed
  with ASP.NET Core's built-in `PasswordHasher<T>` (no new package, no
  Identity tables). No email or SMS provider is called.
- **Sessions:** the framework's built-in bearer token (`AddBearerToken`),
  kept by the client in `sessionStorage` and sent as an `Authorization`
  header. The client (Vercel) and API (Render) are different sites, so a
  session cookie would be a third-party cookie that browsers block; a header
  needs no CSRF protection. Closing the tab forgets the session.
- **Phone code:** simulated. While `DemoSignIn:Enabled` is `true`, the code
  `123456` verifies a number that belongs to an account. No text is sent.
  When the setting is not on, phone sign-in is refused.

### Accounts and roles

`Account` (S.16) links one sign-in to exactly one person:

| Field | Notes |
| --- | --- |
| `Id` | |
| `Kind` | `TeamMember` or `PetParent`, stored as text |
| `StaffMemberId` | set for a team member; foreign key, restrict |
| `OwnerId` | set for a pet parent; foreign key, restrict |
| `Email` | optional, unique, stored lower-case |
| `PhoneNumber` | optional, unique, stored as `+1` and 10 digits |
| `PasswordHash` | set when the account signs in by email |
| `IsActive` | an inactive account can't sign in |
| `CreatedAt` | |

A check constraint holds that exactly one of `StaffMemberId` and `OwnerId` is
set and that it matches `Kind`, and that the account has an email or a phone.
The experience a user lands in comes only from `Kind`, never from the email
address or a choice on the screen. A team member's clinical role
(veterinarian, technician) stays on `StaffMember` for S.6.

### Demo accounts

Fictional, as in the mockup, seeded only when `Database:SeedDemoData` is on
and no account exists yet (accounts have their own seed check):

| Experience | Linked to | Email | Phone |
| --- | --- | --- | --- |
| Hospital team member | Jordan Lee (seeded veterinarian) | `team@vetiflow.demo` | 312-555-0101 |
| Pet parent | Morgan Hale (seeded owner of Buddy) | `parent@vetiflow.demo` | 312-555-0102 |

Both use the demo password `welcome1`, and the screen lists both accounts as
samples. Both use the same made-up domain, which shows the role comes from the
account record.

With demo seeding enabled, a fresh database has 18 active cases, six per
acuity lane. Existing demo databases gain the 15 additional fixtures by stable
IDs; restarting does not duplicate them, overwrite edits or reopen discharged
fixtures. Buddy, Luna and Max remain the original cases. All new contacts and
clinical records are fictional. The existing stale-demo-time refresh still runs.
To backfill the hosted demo, deliberately deploy the API on Render with
`Database__SeedDemoData=true`. A deployment with that flag off does not add
cases. Keep demo seeding off for any database intended for real clinic use.

### Screens and states

One `/sign-in` page, laid out as the stakeholders' landing design
(S.20a; its reference files were removed on 2026-10-29): on screens 85rem and wider the
story ("Care moves fast.") and benefits on the left, the dog-and-cat art in
the middle and the sign-in card on the right; narrower screens stack the
brand, the art as a hero band, the story, the card and the benefits.
Heading "Welcome back", with the
line "Sign in to continue. We'll find the right portal for your account." An
Email / Phone switch (tabs) chooses the method; there is no role choice.

- **Email:** "Email address" and "Password" fields, "Forgot password?", and
  "Sign in".
- **Phone:** "Mobile phone number" and "Text me a sign-in code". Then a
  "Verification code" field with "Verify and sign in", and the note "Demo
  mode: no text is sent. Use code 123456."
- **Working:** the button is disabled and says what is happening while the
  request runs.
- **Field errors:** an empty or badly formed email, number or code is shown
  at the field before anything is sent.
- **No match** (the mockup's wording; demo-only, see limits):
  - unknown email: "We couldn't match that demo account. Try one of the
    sample emails below."
  - wrong password: "Use welcome1 for this demo account."
  - unknown number: "We couldn't match that demo phone. Try one of the
    sample numbers below."
  - code requested: "Demo verification is ready. No text was sent."
  - wrong code: "Use 123456 for this demo."
  - inactive account: "This demo account is turned off."
- **Forgot password?:** "Password reset is a placeholder in this no-cost
  demo." (recovery is S.15).
- **Help:** the top-bar link opens the demo notes (sample accounts, no texts
  sent).
- **Unavailable:** a server or network error shows "Sign-in isn't available
  right now. Try again in a moment."
- **Success:** the mockup's panel: "You're all set". A team member sees
  "Welcome to your care team", a pet parent "Welcome back", then "Continue as
  Hospital team member" or "Continue as Pet parent", and "Back to sign in".
  Continue opens `/er` or `/pet-parent`.
- **Signed in:** `/er` shows "Signed in as <name> (demo)" and Sign out.
  `/pet-parent` shows a calm welcome and the names of the account's own pets
  and whether each is in our care: no acuity, no clinical notes, and no IDs
  in the URL (the API reads the owner from the token).
- **Guards:** signed out, any page goes to `/sign-in`. Signed in, `/sign-in`
  goes home. A pet parent who opens `/er` goes to `/pet-parent`.
- **Session ended:** a `401` after sign-in returns to `/sign-in` with "Your
  session ended. Sign in again."
- **Demo label:** every page says it is a demo with fictional data.
- Messages are announced to screen readers (`aria-live`); every field has a
  label.

### Acceptance criteria

1. The team member signs in by email and by phone and lands on the board.
2. The pet parent signs in by email and by phone and lands on the pet parent
   home with only their own pets.
3. No one chooses a role. Changing an account's `Kind` and link (in the
   database) changes where the same email lands.
4. An unknown email, a wrong password, an unknown number and a wrong code
   each show their message, keep the user on the screen, and sign no one in.
5. No text is sent and no SMS or email service is called. With
   `DemoSignIn:Enabled` off, phone sign-in is refused.
6. A pet parent can't see the board: `/er` redirects, and `GET /api/cases`
   answers `403`. Signed out, it answers `401`.
7. Sign out returns to `/sign-in`, and the back button doesn't reopen the
   board.
8. The screen works at 320 px, tablet and desktop widths with no horizontal
   scroll, by keyboard alone, and with AA contrast.
9. Only fictional data appears, and every page is labelled as a demo.

### Assumptions and production limits to revisit

- The no-match messages name the problem and the demo values, as the mockup
  does. That helps a demo but tells a stranger which accounts exist. With real
  accounts, use one message for a wrong email or password (S.5).
- The fixed code `123456`, the shared password and the listed sample accounts
  are demo-only. `DemoSignIn:Enabled` and the demo accounts exist only in the
  demo environment (8.10), never with real data.
- Production phone sign-in needs an SMS provider (a paid service and a
  decision). Production email sign-in follows the login-provider decision
  (S.5), and pet parent access the owner-access decision (S.8).
- A token in `sessionStorage` can be read by injected script; the CSP in 8.2
  is the guard.
- Token keys are lost when the container restarts, so a redeploy signs
  everyone out. Production keeps the keys or uses the provider's tokens.
- Not in the demo: rate limiting and lockout (S.9), session timeout and quick
  lock (S.14), invitations, recovery and deactivation flows (S.15), per-role
  permissions such as who may set acuity (S.6), and sign-in on the SignalR hub
  (S.7; it sends case IDs only).
- `Account` is the demo's table. S.5 decides whether it is kept, hardened or
  replaced by the chosen provider's accounts.
