# Build Plan

> One of the two planning docs you own. Each line is one work item: one branch,
> one spec, one small PR. Numbers in brackets refer to the issues in the
> "VetiFlow code review and remaining work" doc.

## Rules for this list

- **Mostly open work.** `/complete` ticks a finished item and adds
  `Done (history/features/<file>)`; ticked items are removed at the next
  clean-up of this file. Their spec and result stay in `blueprint/history/`
  (features by ID, fixes by date), and the squash-merge commit on `main`
  carries the PR number. Cleaned up on 2026-10-28.
- **IDs are stable and never reused.** An item keeps its ID once work on it has
  started, because its history file uses that ID. New items take the next free
  number in their phase.
- **The ER Command Center prototype is the design.** Every staff screen is built
  against `blueprint/reference/vetiflow-er-dashboard.html` and must look like
  it: layout, spacing, colours, type, wording and the 1050 px and 650 px
  layouts. The spec's `Design reference` section names the part of the
  prototype it recreates. Where the prototype is silent (errors, loading,
  empty states), follow its visual language.
- **One component at a time, back end first.** A component that needs data is
  split into an `a` item (back end: entity, migration, endpoint, tests) and a
  `b` item (front end: the screen, tests, `/check` against the prototype), and
  `b` follows straight after `a`. A component that needs no new data is a
  single front-end item.
- File order is build order. `/feature` with no ID takes the first unticked
  item. When an item is too big for one PR, `/feature` proposes lettered
  sub-items.
- Bugs and small unplanned changes don't go here. They use `/fix` and land in
  `blueprint/history/fixes/`.
- A dropped item moves to "Dropped" with no checkbox and says why.

## How each item works

Each item goes through the loop in `blueprint/context/ai-interaction.md`:
`/brief <id>` (optional) -> `/feature <id>` -> "OK and build" (`/ready`) ->
`/complete` -> `/approve` -> you squash-merge -> deploy the API on Render
(Manual Deploy, until auto-deploy is turned on). `/audit` runs only when you
ask for it. Aim for a PR of a few hundred lines or less.

Every item that adds a write also:

- records a `CaseEvent` when the change belongs on the case timeline;
- records the staff member who made it (from the signed-in account);
- returns ProblemDetails errors and turns a conflict into a clear `409`;
- disables the control while saving, so a double click can't submit twice;
- adds authorization tests (`401` signed out, `403` for a pet parent).

## Decisions

Decided (later items must keep these):

- **Acuity scale:** decided 2026-10-28, three levels to match the prototype:
  Critical, Urgent, Stable (replacing Critical / Urgent / High / Low from 0.3).
  Stored `High` becomes `Urgent` and `Low` becomes `Stable` (0.4a).
- **Board lanes:** decided 2026-10-28, the board groups cases into lanes by
  acuity, as in the prototype. The stage shows as text on each card, and staff
  change it with the detail panel's **Update status** (4.9). No drag and drop
  between stage lanes.
- **Prototype data:** decided 2026-10-28, every field the prototype shows gets
  real data, built as back-end and front-end item pairs.
- **Wait chip:** decided 2026-10-28, revised the same day for the revised
  prototype. First match wins: a case still in stage Incoming (awaiting
  triage) shows "New"; Critical acuity shows "STAT"; status "ready for next
  step" shows "Ready"; stage Recheck shows "Recheck"; otherwise the minutes
  since arrival ("18 min").
- **New intakes are provisional:** decided 2026-10-28. The intake's priority
  sets the acuity and lane, but the case waits in stage Incoming ("Awaiting
  triage", a "<priority> · provisional" tag, unassigned) until a clinician
  presses **Complete triage** (4.2). Completing triage moves the case to stage
  Triage (awaiting the care team); re-triage keeps the stage; a discharged
  case cannot be triaged (4.2a, recommended defaults).
- **Due items are tasks:** decided 2026-10-28. The next reassessment and the
  next client update are task types with a due time and an assignee, like any
  other task. The panel rows show the next open one of each, My work queue lists
  my open tasks, and "Open actions" counts them. No separate case columns.
- **Shift:** decided 2026-10-28 (for 2.12a). Fixed shifts on the clinic's
  own clock (America/Chicago): Day 08:00 to 20:00, Night 20:00 to 08:00, from the `Clinic`
  setting (`TimeZone`, `DayShiftStarts`, `NightShiftStarts`) until Settings
  (9.3) owns them. 2.15a and 2.16a's "last shift" use the same setting.
- **Care team:** decided 2026-10-28 (for 2.12a). A case has a care team when
  a doctor or a technician is assigned, as on the card.
- **On the floor = My status:** decided 2026-10-28. Each clinician sets My
  status (Busy, Available, At limit, Unavailable), stored on the staff record.
  Anyone not Unavailable counts as on the floor. Feeds the heading's shift chip,
  Workload & team (2.22) and the Team page (4.5).
- **Pain score is its own record:** decided 2026-10-28. A 0 to 10 score with
  optional notes, when and who, recorded from the panel with the clinic's own
  scale. Not a vital and not a tag.
- **Stat cards filter the board:** decided 2026-10-28. Patients in care shows
  all cases, Awaiting triage and Critical patients filter the board, and Avg.
  door to doctor opens its details.
- **Allergies and medications:** decided 2026-10-28, kept on the patient and
  carried to the next visit; each intake also records on the case what was
  confirmed at that visit, so staff can check next time whether the pet is
  still on the same medicines and doses.
- **Intake details** (4.1a, 2026-10-28, recommended defaults): an age as typed
  ("8 years") is stored as an estimated date of birth; the single "Pet parent /
  guardian" field is split at the last space (one word is refused); a phone
  whose digits match an existing owner's reuses that owner.
- **Owners never see the staff board.** Owners get a private page for their own
  pet only, with calm wording and no acuity. Staff and client labels live in
  the client.
- **Security gates real clinic data, not features** (2026-10-26). Features are
  built and shown on demo data first. No real clinic data until M3 and the M7
  gate are done.
- **Sign-in proof of concept** (2026-10-26). A free local simulation: accounts
  in our own database, the framework's password hashing and bearer tokens, and
  a fixed demo phone code. The login-provider and owner-access decisions stay
  open for production.
- **App role delete rights** (2026-10-26). `vetiflow_app` keeps `DELETE` until
  8.13 revokes it.

Open (the item named in brackets needs it before its spec):

- **Door to doctor** (before 2.16a): which moment counts as "seen by a doctor"
  (doctor assigned, or a "Doctor assessment" event), and what "last shift" is.
- **Vital alert ranges** (before 4.8a): the heart rate, respiratory rate,
  temperature and SpO₂ ranges that turn a vital red, per species, from the
  clinic.
- **Notifications** (before 2.17a): what the top bar's bell announces (for
  example a new critical intake, an overdue reassessment, a handoff to me).
- **Stage transition rules** (before 4.9a): which stage moves **Update status**
  allows, for example any move forward and back only to Triage or Recheck.
- **Discharge outcomes and corrections** (before 6.2a and 6.7): the outcome
  list (home, transferred, admitted, deceased) and who may correct or reopen a
  discharged case.
- **Duplicate patients** (before 4.7): warn only, or also merge.
- **Login provider** (before S.5): ASP.NET Core Identity in our own database,
  or an external provider such as Supabase Auth or Microsoft Entra.
- **Owner access** (before S.8): an expiring link or owner sign-in, and how
  long a link lasts.
- **AI table design** (before 5.1): keep `AiSummary` and `Handoff` separate, or
  merge them into one `AiGeneration` table.
- **Pilot scope** (before 8.12): which clinic, how many workstations, the
  go-live date and the fallback to the whiteboard.

## M2: ER Command Center (the prototype)

The staff board rebuilt to `blueprint/reference/vetiflow-er-dashboard.html`,
one component at a time. The current `/er` stage board stays until 2.11b
replaces it. Demo data only.

**Acuity in three levels**

- [x] **0.4a** `feature/acuity-three-levels-api`: `AcuityLevel` becomes Critical, Urgent, Stable, with a migration that updates stored rows (`High` to `Urgent`, `Low` to `Stable`) on cases and triage assessments; seed and tests follow; board sort keeps untriaged, then Critical, Urgent, Stable. Done (history/features/0.4a-acuity-three-levels-api.md).
- [x] **0.4b** `feature/acuity-three-levels-client`: client types, labels and badges for the three levels, in the prototype's colours (red, amber, teal). Done (history/features/0.4b-acuity-three-levels-client.md).

**App shell** (prototype: left rail, top bar)

- [x] **2.10a** `feature/app-shell-api`: `GET /api/auth/me` adds what the profile needs: the staff member's role and display name ("Dr. Jordan Reed" for a veterinarian) and initials. Done (history/features/2.10a-app-shell-api.md).
- [x] **2.10b** `feature/app-shell`: the rail (brand mark, Overview, ER board, Patients, Team, Reports, Settings) and top bar (breadcrumb, search box, bell, profile) around every staff page; Patients opens the records page (`/records`) inside the shell, the other destinations show a calm "coming soon" page until their items; sign out from the profile; the toast used across the Command Center; the 650 px rail and top bar. Done (history/features/2.10b-app-shell.md).

**Case numbers**

- [x] **3.4a** `feature/case-number-api`: a human case number per case ("ER-2481") from a database sequence, with a migration that numbers existing cases, shown in the board list and case detail. (Shown on screen by 2.11b and 3.2b.) Done (history/features/3.4a-case-number-api.md).

**Patient flow board** (prototype: "Patient flow")

- [x] **2.11a** `feature/patient-flow-api`: the board list adds what each card shows: case number, patient age, owner name, location (room and area), the stage and minutes in it, the wait chip value, and the assigned clinician's short name and initials. Done (history/features/2.11a-patient-flow-api.md).
- [x] **2.11b** `feature/patient-flow-board`: replace the stage lanes with the prototype's acuity lanes (Critical, Urgent, Stable, with counts), the new cards (name, species · breed · age, wait chip, owner · complaint, tags, stage · minutes, assigned clinician), incoming cards' "<priority> · provisional" tag, "Awaiting triage" and "Unassigned", the selected card, "Updated just now · N active cases", the footer count, live updates through the hub, and the 650 px lane tabs. Done (history/features/2.11b-patient-flow-board.md).

**New patient intake** (prototype: intake dialog; provisional priority)

- [x] **4.1a** `feature/case-intake-api`: create a case for a new or existing patient from the intake fields (name, species, breed, age, pet parent and phone, chief complaint, initial priority through `RecordTriage`, triage notes, allergies, medications, treatment authorization, referring clinic), with the new columns and migration; a second active case for the same patient returns `409` naming the active case; writes `Arrived`; arrival time is set by the server. Done (history/features/4.1a-case-intake-api.md).
- [x] **4.1b** `feature/case-intake-form`: the "New patient intake" dialog exactly as in the prototype (two-column form, priority radios, focus on open, Escape and backdrop close, focus returned), field errors, "Add to triage queue" adds the card to its lane, and a toast. Done (history/features/4.1b-case-intake-form.md).

**Triage** (prototype: **Complete triage**, acuity badge, lanes)

- [x] **4.2a** `feature/triage-api`: complete triage on an incoming case (confirm or change the provisional priority, move it out of Incoming) and re-triage later, always through `RecordTriage` (clinicians only once roles exist), with `Triaged` on the timeline. Done (history/features/4.2a-triage-api.md).
- [x] **4.2b** `feature/triage`: **Complete triage** in the panel for incoming cases, re-triage from the panel's **•••** menu; the card's chip, tag and lane update on every open board. Done (history/features/4.2b-triage.md).

**Stats row** (prototype: four clickable stat cards)

- [x] **2.12a** `feature/board-summary-api`: `GET /api/board/summary`: patients in care and how many arrived since the shift began, awaiting triage (cases in Incoming) and the oldest wait, critical patients and whether all have a care team. Door to doctor follows in 2.16a. Done (history/features/2.12a-board-summary-api.md).
- [ ] **2.12b** `feature/board-stats`: the four stat cards as in the prototype, refreshed with the board, as filters: Patients in care shows all cases, Awaiting triage and Critical patients filter the board (pressed state, footer text); door to doctor shows "—" until 2.16b.
- [ ] **2.14** `feature/board-search-filter`: the top bar's "Search patients…" filters the board's cards as you type (and offers the Patients search for patients not on the board), the **Incoming** toggle with its count, **Filter** (clinician, species, case status) and **Priority** sort. No new back end: it works on the loaded cases and the 4.6a search.

**My status** (prototype: "My status" in My patients, clinicians on floor)

- [ ] **2.21a** `feature/staff-status-api`: each clinician's status (Busy, Available, At limit, Unavailable) on the staff record, with a migration; set my own status; list clinicians on the floor (not Unavailable) with their status and active case count.
- [ ] **2.21b** `feature/staff-status`: the My status selector, saved with a toast ("Availability set to Busy").

**Page heading** (prototype: hospital name, title, shift, New intake)

- [ ] **2.15a** `feature/shift-api`: the clinic's name (from clinic settings, a setting until 9.3) and the current shift from the `Clinic` setting (2.12a), with the number of clinicians on the floor from My status (2.21a).
- [ ] **2.15b** `feature/board-heading`: the eyebrow, "ER Command Center" title and subtitle, the live shift chip and the **New intake** button opening the intake dialog (4.1b).

**Patient overview panel** (prototype: right-hand panel)

- [x] **3.2a** `feature/patient-overview-api`: the case detail (3.1) adds case number, check-in time, patient age, location (room and area), minutes in stage, and the intake fields (allergies and medications on the patient and at this visit, treatment authorization, referring clinic); no new writes. Next reassessment and client update come from 4.4a. Done (history/features/3.2a-patient-overview-api.md).
- [x] **3.2b** `feature/patient-overview-panel`: the panel beside the board for the selected card: header with case number and check-in time, the patient hero (species avatar, name, species · breed · age · weight, acuity badge), the pet parent bar, the vitals tiles, location, care timeline (pending items marked) and next actions; it stacks under the board at 1050 px; the **•••**, Call, Message, Add task, Handoff and Update status controls are shown and wired by the items below. Done (history/features/3.2b-patient-overview-panel.md).

**Next actions and due items** (prototype: task list, "Next reassessment", "Client update")

- [ ] **4.4a** `feature/case-tasks-api`: create, complete and reopen tasks and blockers on a case, with who did it and when; task types include Reassessment and Client update with a due time and an assignee (replaces 4.10a); the case detail and board list return the next open one of each.
- [ ] **4.4b** `feature/next-actions`: the checklist with done ticks and assignee, **＋ Add task**, open blockers still shown on the card, and the panel's "Next reassessment" and "Client update" rows ("Due in 8 min", "Due 11:15 AM", overdue in words and colour) with setting them (replaces 4.10b).

**Vitals and pain** (prototype: four vitals tiles, pain score meter)

- [ ] **4.8a** `feature/vitals-api`: add SpO₂ to `VitalsRecord` (migration), record vitals through `RecordVitals` (never changes acuity), and return which readings are outside the decided ranges; a pain score record (0 to 10, optional notes, when and who; migration) with the latest on the case detail and board list.
- [ ] **4.8b** `feature/vitals-tiles`: the heart rate, resp rate and temperature tiles (°C, "Not recorded" when missing) exist from 3.2b; 4.8b adds the SpO₂ value, the red alert style and recording a new set from the panel; the pain score meter and the **Record score** dialog.

**Update status** (prototype: "Update status" button)

- [ ] **4.9a** `feature/case-status-api`: change stage, status and next action in one request, enforcing the stage transition rules, writing `StageChanged` and `StatusChanged`, and broadcasting `caseUpdated` (replaces the bare stage endpoint's rules gap, old 2.1) [10, 11].
- [ ] **4.9b** `feature/update-status`: the **Update status** dialog from the panel, the card moving or updating on every open board, and the toast "Status updated · team notified".

**Clinical tags** (prototype: tags on cards)

- [ ] **3.5a** `feature/case-tags-api`: short clinical tags on a case ("Respiratory distress", "O₂ support") with a tone (alert, caution, info, neutral); add and remove, with limits.
- [ ] **3.5b** `feature/case-tags`: tags on cards in the prototype's colours, and adding or removing them from the panel.

**Care team and location** (prototype: assigned clinician, location row)

- [ ] **4.3a** `feature/assignment-api`: assign the doctor, technician and room; a room already holding an active case returns `409` naming that case.
- [ ] **4.3b** `feature/assignment`: assign from the panel's **•••** menu; the card's clinician and the panel's location update live.

**Pet parent contact** (prototype: pet parent bar, Call and Message)

- [ ] **6.4a** `feature/owner-contact-api`: record each owner contact (when, how, by whom, outcome), keeping `OwnerUpdateStatus`, `LastOwnerUpdateAt` and the next client update in step; contact details never reach the board list.
- [ ] **6.4b** `feature/owner-contact`: Call (a `tel:` link) and Message from the pet parent bar, logging the contact, and the client update row moving on.

**Handoff** (prototype: "Handoff" button)

- [ ] **6.1a** `feature/handoffs-api`: write a handoff, list open tasks and blockers as outstanding work, choose the recipient, acknowledge.
- [ ] **6.1b** `feature/handoffs`: the **Handoff** dialog from the panel and acknowledging a handoff. AI drafting is 5.5.

**Discharge**

- [ ] **6.2a** `feature/discharge-api`: discharge with an outcome, set `DischargedAt`, free the room, write `Discharged`; the case leaves the board.
- [ ] **6.2b** `feature/discharge`: discharge from **Update status** (or **•••**), with the outcome and a toast; the card leaves every open board.

**Door to doctor** (prototype: fourth stat card and its details)

- [ ] **2.16a** `feature/door-to-doctor-api`: record the moment a doctor first sees a case (per the decision) and add the shift average and the change from the last shift to the summary.
- [ ] **2.16b** `feature/door-to-doctor`: the stat card's value and "↓ 4 min vs. last shift", the "Door to first doctor" details dialog (current and previous shift) and **Show waiting patients**, which filters the board to cases still waiting for their first doctor.

**My patients** (prototype: "ER board | My patients" switch, clinician workspace)

- [ ] **2.22a** `feature/my-patients-api`: my workspace for the signed-in clinician: my active cases with acuity, location, latest alerting vital, pain score, next reassessment and next action; my open tasks with due times (My work queue); my counts (active by acuity, needs attention, open actions); and Workload & team from My status.
- [ ] **2.22b** `feature/my-patients`: the **ER board | My patients** switch, "Clinician workspace" heading, my stat cards, "Assigned to me" cards with **Open case** (opens the board with that patient selected), My work queue, Workload & team, and the 650 px layout.

**Duplicates** (prototype: intake dialog)

- [ ] **4.7** `feature/duplicate-patients`: warn on likely duplicates (same name, species and owner) in the intake dialog; merge only if the decision says so.

**Notifications** (prototype: bell with a dot)

- [ ] **2.17a** `feature/notifications-api`: the notifications the decision names, read and unread, pushed through the hub.
- [ ] **2.17b** `feature/notifications`: the bell's dot and a list that opens from it.

**Patients page** (prototype: "Patients" in the rail)

- [ ] **4.6c** `feature/records-forms`: new and edit forms for patients and owners on the Patients page, in the prototype's form style, including choosing or clearing the owner.

**Typography** (prototype: DM Sans text, Manrope headings)

- [ ] **2.20** `feature/command-center-fonts`: load the prototype's fonts for the staff pages (DM Sans for text, Manrope for headings and numbers), with a choice of font package or host and a fallback that keeps the layout. (Found in 2.10b: the shell matches the prototype except for its fonts.)

## M3: Sign-in and roles

Needs the login-provider decision. Can run alongside M2. Must be done before
real clinic data.

- [ ] **S.5** `feature/auth-login`: staff login (provider per the decision, building on or replacing the proof of concept), secure cookies or short-lived tokens, logout, CSRF protection if cookies are used; every endpoint requires a signed-in user by default.
- [ ] **S.15** `feature/staff-accounts`: invite a staff member, link the account to a `StaffMember`, deactivate (blocks sign-in at once), and account recovery per the provider.
- [ ] **S.6** `feature/auth-roles`: roles (Veterinarian, Technician, Manager, Owner) and policies, so for example only clinicians set acuity or confirm AI output.
- [ ] **S.7** `feature/hub-authorization`: require sign-in on the SignalR hub, pass the token safely, broadcast IDs only.
- [ ] **S.14** `feature/session-timeout`: short idle timeout and a quick lock for shared ER workstations.
- [ ] **S.9** `feature/rate-limiting`: ASP.NET Core rate limiter on login, writes and AI endpoints [19].

## M4: The rest of the rail

The rail's other destinations, in the prototype's style.

- [ ] **4.5** `feature/team-view`: the Team page: who is on the floor (My status, 2.21) and each clinician's active cases, derived from case data.
- [ ] **2.18** `feature/overview`: the Overview page (contents to be designed; needs a design in `blueprint/reference/` first).
- [ ] **2.19** `feature/reports`: the Reports page (contents to be designed; needs a design first).
- [ ] **2.8** `feature/timer-escalation`: wait times turn amber and red past per-acuity thresholds from clinic settings [24].

## M5: Administration, history and reliable live behaviour

- [ ] **9.3** `feature/clinic-settings`: clinic name, shift hours and timer thresholds (the Settings page; feeds 2.15 and 2.8).
- [ ] **9.1** `feature/staff-admin`: managers add, edit and deactivate staff members and their roles.
- [ ] **9.2** `feature/room-admin`: managers add, rename and retire rooms; a room with an active case can't be retired.
- [ ] **6.6** `feature/case-history`: list and search discharged cases, and open one read-only in the panel ("Full record ↗").
- [ ] **6.7** `feature/case-corrections`: correct or reopen a discharged case per the decision, with a `CaseEvent` for each change.
- [ ] **2.4** `feature/board-data-loading`: no refetch races, keep the last good data on errors, loading and error states inside the board [22, 23].
- [ ] **2.5** `feature/live-connection-status`: retry forever, refetch on reconnect, and "Updated just now" turning into Reconnecting or Offline when the hub is down [21].
- [ ] **2.2** `feature/case-concurrency`: `xmin` concurrency token, `409` with the current state, and the client showing the conflict [12].

## M6: Private owner experience

- [ ] **S.8** `feature/owner-access-control`: owners see only their own pet's case (resource-based checks, no guessable links); access expires and staff can revoke it. Replaces the demo pet parent sign-in for production.
- [ ] **6.5** `feature/owner-updates`: staff write an owner-facing update, and a clinician approves it before the owner page shows it.
- [ ] **6.3** `feature/owner-page`: the private owner page, with client labels and only staff-confirmed notes. Replaces the demo pet parent home.

## M7: Launch gate and pilot

All of these must be done before VetiFlow holds real clinic data.

- [ ] **8.10** `chore/demo-environment`: a separate Render service and Supabase project with demo data only; Vercel previews point at demo. Demo sign-in exists only there.
- [ ] **7.4** `feature/demo-mode`: Reset demo button, scheduled reseed and a write rate limit, in the demo environment only [19, 20].
- [ ] **S.10c** `chore/app-role-cutover`: switch Render's API connection to the `vetiflow_app` login (password set in Supabase), as planned in S.10b's deploy notes.
- [ ] **8.1** `feature/audit-log`: who viewed or changed patient and owner data, and when; viewable by managers.
- [ ] **8.2** `feature/security-headers`: CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors and `X-Robots-Tag: noindex` on Vercel and the API.
- [ ] **8.3** `chore/log-redaction`: keep patient and owner details, tokens and connection strings out of logs.
- [ ] **7.5** `chore/logging`: structured logging with correlation IDs.
- [ ] **8.5** `chore/privacy-data-handling`: synthetic data only in the demo, a retention policy, owner data export and delete, a privacy notice.
- [ ] **8.13** `chore/revoke-app-delete`: once the schema is final, revoke `DELETE` from `vetiflow_app` except where a feature needs it, with a test.
- [ ] **8.6** `chore/backups`: Supabase backups or point-in-time recovery, with a tested restore.
- [ ] **8.9** `chore/monitoring`: uptime alert on `/api/health`, error alerting and log retention.
- [ ] **8.14** `chore/render-auto-deploy`: Render auto-deploys after CI passes, and a check that warns when the live API is behind `main`.
- [ ] **8.7** `chore/security-scanning`: Dependabot for npm and NuGet as well as GitHub Actions; keep CodeQL on.
- [ ] **7.6** `chore/accessibility-pass`: AA contrast, keyboard and screen reader checks across the Command Center at desktop, 1050 px and 650 px.
- [ ] **7.2** `test/playwright-sync`: two browsers, change a case in one, assert the other updates.
- [ ] **7.8** `test/playwright-journey`: intake -> triage -> assignment -> status changes -> discharge in a browser.
- [ ] **1.5** `docs/readme`: README with a screenshot, the live link and local setup.
- [ ] **8.11** `docs/operator-runbook`: deploy, migrate, roll back, restore, rotate secrets, onboard and offboard staff, incident contacts.
- [ ] **8.8** `docs/security-review`: threat model, a pre-launch checklist, and a final review of auth, the hub and the owner page.
- [ ] **8.12** `chore/pilot-readiness`: pilot checklist, staff training notes, a feedback route and the whiteboard fallback.

## M8: AI assistance

After M7. Every workflow keeps working without AI.

- [ ] **5.1** `feature/ai-provider`: `IAiProvider` with a real provider and a deterministic fake for CI and demos.
- [ ] **5.2** `feature/ai-intake-summary`: JSON schema (summary, missing information, conflicts, urgency signals, no treatment advice), validation, retry once, prompt version and model stored.
- [ ] **5.3** `feature/ai-review-ui`: "AI DRAFT, unconfirmed" badge in the panel, a confirm button, "Confirmed by … at …".
- [ ] **5.4** `feature/ai-resilience`: timeouts, manual fallback, "AI unavailable" state, rate limiting on AI endpoints.
- [ ] **5.5** `feature/ai-handoff-draft`: AI drafts the handoff text for 6.1; staff edit and confirm it.
- [ ] **8.4** `feature/ai-data-safety`: strip owner contact details before anything reaches the AI provider, treat intake notes as untrusted, no training on our data, limited retention.

## Later

- [ ] **2.13** `feature/activity-feed`: `GET /api/events` and a feed of recent events pushed through SignalR (not in the prototype).
- [ ] **1.7** `chore/release-notes`: tidy PR descriptions, `.github/release.yml` grouping merged PRs by label, and the first release tag.
- [ ] **7.3** `chore/openapi-client`: generate the TypeScript client from OpenAPI.
- [ ] **7.7** `docs/adrs`: ADRs in `docs/` (why SignalR, why Postgres, why no Redux).

## Dropped

- **2.1** `feature/stage-update-rules`: merged into 4.9a (decided 2026-10-28, stages change through Update status).
- **2.6** `feature/drag-and-drop`: dropped 2026-10-28; the prototype's lanes are acuity, not stages.
- **2.7** `feature/keyboard-stage-menu`: dropped 2026-10-28; Update status (4.9b) is the way to change a stage, by mouse or keyboard.
- **3.3** `feature/card-details`: covered by the prototype's cards (2.11b) and tags (3.5).
- **7.1** `test/integration-tests`: delivered by 1.2; new items add their own API and database tests.
- **4.10a** `feature/case-schedule-api` and **4.10b** `feature/case-schedule`: merged into 4.4a and 4.4b (decided 2026-10-28, due items are tasks).
