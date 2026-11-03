# Build Plan

> One of the two planning docs you own. Each line is one work item: one branch,
> one spec, one small PR. Numbers in brackets refer to the issues in the
> "VetiFlow code review and remaining work" doc.

## Rules for this list

- **Mostly open work.** `/complete` ticks a finished item and adds
  `Done (history/features/<file>)`; ticked items are removed at the next
  clean-up of this file. Their spec and result stay in `blueprint/history/`
  (features by ID, fixes by date), and the squash-merge commit on `main`
  carries the PR number. Cleaned up on 2026-10-28 and 2026-11-03.
- **IDs are stable and never reused.** An item keeps its ID once work on it has
  started, because its history file uses that ID. New items take the next free
  number in their phase.
- **One master roadmap; page-specific requirements.** This file owns work
  IDs, order, dependencies and completion. Each page gets a folder under
  `blueprint/reference/` with its requirements, prototype and a README mapping
  requirements to these IDs. Do not maintain independent page build queues
  or duplicate shared patient, encounter, task and permission models.
- **Requirements define behavior; prototypes declare their fidelity.** The
  current ER source is `reference/er-board-poc/` (2026-11-02):
  `VetiFlow-Product-Rules.md` holds the requirements and
  `VetiFlow-ER-Prototype.html` guides visual hierarchy and the shared patient
  record, not pixel-exact design. The person's decisions below take precedence
  over the prototype where they conflict, and written requirements over legacy
  HTML, demo values and hidden scripts. Retain the current design system,
  readable type, 1px focus and 700 bold. The separate Veterinarian and
  Technician My Patients packages were consolidated into the product rules on
  2026-11-02; see that folder's README for the requirement-to-ID mapping.
- **One component at a time, back end first.** A component that needs data is
  split into an `a` item (back end: entity, migration, endpoint, tests) and a
  `b` item (front end: the screen, tests, `/check` against the prototype), and
  `b` follows `a` when its dependencies are available. A shared API may serve
  both role interfaces; name the consumers rather than building duplicate APIs.
  A component that needs no new data is a single front-end item. Clinical
  foundation APIs may precede the workspace shell that hosts their controls.
- File order is build order. `/feature` with no ID takes the first unticked
  item. When an item is too big for one PR, `/feature` proposes lettered
  sub-items.
- Bugs and small unplanned changes don't go here. They use `/fix` and land in
  `blueprint/history/fixes/`.
- A dropped item moves to "Dropped" with no checkbox and says why.

## How each item works

Each item goes through the loop in `blueprint/context/ai-interaction.md`:
`/brief <id>` (optional) -> `/feature <id>` -> "OK and build" (`/ready`) ->
`/complete` -> `/approve` -> you squash-merge -> CI and deployment of the
affected services, as described in project-plan section 8. Client-only work
does not require an API redeploy. `/audit` runs only when you ask for it.
Aim for a PR of a few hundred lines or less.

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
- **Board lanes:** superseded 2026-11-02 by **Board layout** below. Kept for
  history: decided 2026-10-28, the board grouped cases into lanes by acuity.
  The stage showed as text on each card, and staff change it with the detail
  panel's **Update status** (4.9). No drag and drop between stage lanes.
- **Board layout** (decided 2026-11-02, by the person): a table on desktop
  (Patient, Acuity, Care stage, Care team) and compact patient cards on
  phones (2.25). Acuity stays clearly visible as a text pill and filterable.
  Stage changes still go through **Update status**; no drag and drop.
- **Patient header quick edits** (decided 2026-11-02, by the person): the
  patient header shows the current care stage and location as buttons that
  open the small modals shipped in 4.3b (3.2c), not inline dropdowns. The
  presenting complaint stays read-only; the prototype's Edit action is not
  built. Amends **Patient Overview quick edits** below.
- **Demo role switch** (decided 2026-11-02, by the person): an app-wide
  Veterinarian / Technician switch labelled "Demo role — simulated access",
  for development and demonstrations (2.28). It changes the displayed
  controls and the My patients filters while preserving the selected patient
  and the shared demo data. It is independent of sign-in: the signed-in
  account is unchanged, and account linking or account-to-role mapping is not
  required yet. It is never authorization; real, server-enforced permissions
  remain part of S.6, and 3.7b's "no demo role dropdown as an authorization
  mechanism" still holds.
- **Navigation** (decided 2026-11-02, by the person): the app keeps its
  destinations (Overview, ER board, Patients, Team, Reports, Settings). On
  phones a bottom bar shows them, with an overflow menu for destinations that
  do not fit comfortably (2.27). The standalone prototype's reduced navigation
  does not supersede the app's navigation.
- **Assignment order** (decided 2026-11-02, by the person): assign a primary
  technician first when possible, then the attending veterinarian. This is a
  default workflow, not a mandatory dependency: either may happen first in an
  emergency, and neither blocks care. Technicians are assigned to patients,
  never permanently paired with doctors. Tech and Vet show consistently in
  both role views, technician first, with explicit "Unassigned" values; role
  switching never changes a column's meaning. Intake may record either
  assignment (4.1c).
- **Board sort** (decided 2026-11-02, by the person): the board's acuity
  order stays fixed, Critical then Urgent then Stable. The sort control keeps
  2.14d's behaviour, longest time in the current stage first within each
  acuity, under an explicit label such as **Time in stage ↓** with a tooltip
  that explains the sort (2.26). The prototype's Priority ↓/↑ acuity reversal
  is not built and does not replace 2.14d; the prototype was updated to match.
  Reaffirmed 2026-11-02 when the designer's revision brought Priority ↓/↑
  back: that was a leftover, and the canonical prototype was corrected again.
- **Clinical tab** (decided 2026-11-02, by the person): the Clinical tab
  matches `blueprint/reference/er-board-poc/Clinical.png` now (3.2e).
  - Controls whose back end is not built yet are shown in place but disabled,
    each with a tooltip naming the build item that enables it. Nothing is saved
    in the browser or faked.
  - Existing recorded detail is never removed for the mockup. Measurement and
    entry times, the recorder, the previous-set comparison and mentation go in
    a "Recorded vitals & assessment" disclosure at the end of Clinical.
  - Allergy source, verification status, verifier and time go in a separate
    "Allergy details" disclosure, opened from the header's allergy indicator.
  - Overview keeps the quick snapshot.
- **Record panel and page header** (decided 2026-11-02, by the person, after
  the designer's revision of the prototype and `header.png`). These override
  conflicting prototype behaviour.
  - **One scrolling surface:** on desktop the patient record scrolls with the
    page, with no scrollbar of its own. This takes precedence over 3.2c's
    sticky record header, which may scroll away. On tablets and phones the
    record drawer is the only thing that scrolls: background scrolling is
    locked while it is open (2.27).
  - **Compact patient header:** the prototype's compact header (name, acuity
    button with ⌄, close ✕ on one row; case number inline in the meta line;
    labelled Stage and Location buttons with ⌄; tighter allergy line, tabs and
    Clinical spacing) (3.2f).
  - **Close ✕:** clears the selected record and returns to the board without
    changing its filters, search, sort or scroll position.
  - **Acuity button:** opens the existing triage flow under the existing
    acuity-edit rules. The new styling never broadens who can change acuity,
    and acuity still changes only through `EmergencyCase.RecordTriage`.
  - **Account bar:** the bell, avatar and signed-in user stay in the app's top
    bar only; they are not repeated in the page header.
  - **Page heading:** the compact heading (eyebrow and title) with the shift
    status and New intake beside it, without the old subtitle (2.26b). The
    demo-role row stays with 2.28.
- **Prototype data:** revised 2026-10-30. Required fields use the shared
  encounter record, with back-end/front-end pairs where new data is needed.
  Fictional HTML values are not requirements or a source of patient facts.
  Show honest missing states until real data exists; do not invent assessments,
  medication records, assignments, approvals or treatment recommendations.
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
  case cannot be triaged (4.2a, recommended defaults). Amended 2026-11-02 by
  **Assignment order**: intake may record a primary technician and attending
  veterinarian (each optional); the case still waits in Incoming until
  Complete triage.
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
- **Pain records and placement:** the 0-10 records delivered in 4.8a-d remain
  historical data, separate from vitals and tags. The 2026-10-30 ER requirements
  supersede the planned generic Overview slider (4.8f). Do not portray this
  legacy score as a validated species-specific scale. Any new pain workflow
  needs an approved species-specific protocol and the separate clinical workspace.
- **Stat cards filter the board:** decided 2026-10-28. Patients in care shows
  all cases, Awaiting triage and Critical patients filter the board, and Avg.
  door to doctor opens its details.
- **Discharge leaves the board** (decided 2026-11-01, by the person). Moving a case to the Discharge stage records its discharge time and removes it from the ER board, and its room is freed. This is a discharge record, not a clinical departure. It supersedes the "readiness is not departure" rule for the Discharge stage only; departure, admission, transfer and death outcomes stay with 6.2e.
- **Case tags removed for now** (decided 2026-11-02, by the person). Free-text tags drift: each person words a situation their own way until there are dozens of near-duplicate tags that mean nothing. Tags come back only as a clinic-approved list that staff select from, never type; until such a list exists, tags are removed (3.5c). Past "Tag added/removed" timeline entries stay as history.
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
- **ER Overview scope** (2026-10-30): shared coordination, not a full chart.
  Support identity/acuity, complaint, stage/location, a documented next step,
  numeric vitals, safety/care team, approved client communication and three
  read-only quick-access views. Move full chronology, assessment details and
  full task lists out of the compact panel once equivalent review access exists.
  Updated 2026-11-02: the three quick-access drawers become the Clinical,
  Orders & Medications and Timeline tabs of the patient record (3.2c).
- **My Patients role designs received** (2026-10-30; source updated
  2026-11-02): use the consolidated `reference/er-board-poc/VetiFlow-Product-Rules.md`,
  which replaced the separate veterinarian and technician packages, not the
  obsolete workspace embedded in older ER HTML. Both share the shell, one patient queue, a wider
  selected chart, three distinct-patient metric filters and adjacent acuity
  badges. Role-specific tabs and actions differ; no extra attention sidebar,
  fourth draft metric or staff productivity scoring. Navigation stays inactive
  until implemented/authorized, not because a prototype is still missing.
- **Documented state, not live clinical truth** (2026-10-30): show source and
  freshness; measurement/event time is distinct from entry time. Existing
  RecordedAt is entry time and must not be silently relabelled as measured time.
- **Role-safe summaries** (2026-10-30): reception sees operational information
  and authorized approved client wording, not raw intake/clinical notes.
  Server-side field projections/policies precede a mixed-role rollout; a role
  selector or hidden component is not authorization. Owner access stays separate.
- **Clinical uncertainty and accountability** (2026-10-30): unknown allergy or
  medication history is not a negative finding. Preserve task creator, assigner,
  performer, reviewer, due times and history where applicable. Do not derive
  employee competency or productivity rankings from these events.
- **Readiness is not departure** (2026-10-30): discharge preparation/medical
  clearance do not remove a patient from the census or free its room. Departure
  and admission/transfer/death outcomes need explicit approved workflows.
- **Distinct clinical events** (2026-10-30 role specifications): task performed,
  request received, clinical review, order authorization, result interpretation,
  handoff acceptance and concern resolution are separate facts. An authorized
  order version gates medication administration; a draft or held/discontinued
  order cannot be treated as active authority. Preserve actual actors and times.
- **Interrupted documentation** (2026-10-30): server-persisted unsigned drafts
  and explicit signing/amendments share version/history rules across both
  roles. Capture the encounter and input before an autosave delay; flush or
  protect pending edits on navigation. Do not store clinical drafts in browser
  localStorage/sessionStorage or misrepresent in-memory demo state as recovery.
- **Coverage and follow-up** (2026-10-30): attending, temporary cover, primary
  technician/shared pool, review recipient and follow-up owner are distinct.
  Unresolved diagnostics/concerns retain named ownership after departure.
  A sent handoff is not accepted responsibility, and receipt is not clinical resolution.
- **Security Lab portfolio slice** (2026-10-30): the supplied security-poc is
  a single-hospital, fictional-data, development/test demonstration of real
  server enforcement. It is optional within M3, before the larger clinical
  workspace work, and does not replace production authentication, full clinical
  permissions, audit or the launch gate. The browser POC is simulation only.
  Clinical accounts cannot view its security events; an explicitly authorized
  development/security operator is a separate access boundary. Lab routes and
  execution/audit APIs are absent in production regardless of client flags.

Open (the item named in brackets needs it before its spec):

- **Security Lab boundary** (before S.21a): operator identity/provisioning and
  how scenario execution uses actual authenticated fictional actors (separate
  sign-ins or a bounded operator-controlled harness with explicit attribution).
  Client role/user_id fields are never authority. Choose the isolated local/test
  database and minimal order-fixture storage; reuse the current .NET/Postgres
  stack and existing domain/identity where possible. A lab-only authorization
  fixture must not become a real medication order or administration entitlement.

- **Door to doctor** (before 2.16a): which moment counts as "seen by a doctor"
  (doctor assigned, or a "Doctor assessment" event), and what "last shift" is.
- **Validated vital alerts** (before 4.14a): approved species/context-aware
  ranges and their source, reviewers and configuration. 4.8a's delivered demo
  flags are not clinical validation; 2.23 removes their clinical-looking
  emphasis from the shared Overview pending this work.
- **Notifications** (before 2.17a): what the top bar's bell announces (for
  example a new critical intake, an overdue reassessment, a handoff to me).
- **Stage transition rules** (before 4.9a): which stage moves **Update status**
  allows, including hospital vocabulary and transition events. The new
  specification's illustrative stages do not rename existing stored enums.
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
- **Entry-workflow cutover** (before 2.23): where existing Record vitals,
  triage and task-entry actions remain while My Patients is inactive. Preserve
  working documentation access until a replacement is approved; the read-only
  drawers must not become improvised full charting forms.
- **Action selection** (before 4.13a): explicit clinical priority, review state,
  due-soon policy and tie-breaking. An overdue administrative task must not
  automatically outrank a documented clinical priority; no algorithmic treatment advice.
- **Build the simplest working version first** (decided 2026-11-02, by the person): each feature implements only what its current workflow needs, reuses existing components, APIs, tables and dialogs, and adds no speculative framework or model for unapproved future requirements. Dependencies are enforced only where security, data integrity or function genuinely need them; a dashboard is not blocked because advanced features are incomplete. Patient safety, authentication and server-side authorization, data integrity and concurrency, audit history, accurate documentation, and the separation of unverified from confirmed information are never traded for simplicity. Current order: 4.3a (location and assignment), then, at the person's request on 2026-11-02 to prioritize the application's UI/UX, the ER board prototype alignment items 2.25, 3.2c, 3.2d, 2.26, 2.27, 2.28 and 4.1c, then 4.13b (Care Coordination card, with priority and designation in the existing Tasks and due items dialog), S.5 and S.6 (sign-in and role permissions), then My Patients 2.22a-d (secure queue and read-only chart), with advanced clinical workflows added as their requirements and APIs are ready.
- **Patient Overview quick edits** (decided 2026-11-02, by the person; amended the same day by **Patient header quick edits**, which moves the stage and location buttons into the patient header): a quick edit is something staff finish in a few clicks without opening a full chart. Four are edited from the Patient Overview, each from the section staff expect it and each in a small modal so it works at phone width (2026-11-02): Current Location (a room dropdown) in Care Coordination; Care Stage in Patient Status, using the existing stages and Update status rules (4.9a); Attending Veterinarian and Primary Technician (including "Not assigned") in Care Team. Two use existing dialogs: Re-triage through More actions, and the Next Care Action through the Tasks and due items dialog. Care Coordination does not hold all four controls. Read-only in the overview: vitals and clinical assessments, medications, presenting complaint and medical notes, the timeline (written automatically), task completion and priority (managed in Tasks and due items until My Patients is ready) and client communication (the latest approved update is shown; new communication uses its own workflow). Editing rights: authorized staff for location and care team, authorized veterinarians and technicians for stage, re-triage and next care action; until S.6 every signed-in team member may edit, always checked on the server.
- **Next care action and task priority** (decided 2026-11-02, by the person): clinical priority is set only by an authorized veterinarian or veterinary technician, never by VetiFlow's software. Priority is Urgent, High or Routine; an unset priority is shown as "Not prioritized". An authorized clinician explicitly designates one documented open task as the Next Care Action, and the Patient Overview shows that task with its priority, assignee, due time and status. VetiFlow never ranks tasks, chooses or changes the designated action, or changes a priority. Due-soon and overdue labels are informational only. Completing or cancelling the designated task, or discharging the patient, clears the designation without promoting another task; no action is designated until staff choose one. Priority and designation changes are recorded on the case timeline. Until server-enforced roles exist (S.6), any authenticated team member with task-management access may set priority and designate, as a temporary policy; S.6 restricts both to authorized veterinarians and veterinary technicians, enforced on the server and never by a UI check. The automatic-ranking rule proposed earlier on 2026-11-02 was rejected and is part of no item.
- **Clinical/reception visibility** (before S.6 and 3.7a): the field/action
  permission matrix, including assistants, reception and supervisor access.
  Who can approve client wording and handle escalation (before 6.5a).
- **Freshness and retrospective entry** (before 4.11a/b): measured/event-time
  capture and validation, unknown historical times, hospital stale thresholds
  and overdue reassessment wording. Do not substitute entry time for event time.
- **Role queue rules** (before 2.22a/b): first-version default under the 2026-11-02 simplicity decision, to be confirmed in the 2.22a spec: "Assigned to me" lists
  active cases where the signed-in clinician is the attending veterinarian or assigned technician; "All active" lists every active case; counts are distinct
  patients. Shared-pool and cover eligibility, review counters and escalation/result-review responsibilities are added with their workflows; when added,
  unresolved escalations and result reviews must not disappear merely because related tasks are complete.
- **Clinical protocols and authority** (before 4.15c, 4.18c and 4.19c): which
  actors/credentials can sign, authorize, administer, amend or discontinue each
  record/order type; required reasons and checks; approved species-specific
  assessment protocols. Supplied UX designs do not resolve these hospital rules.
- **Draft recovery and conflicts** (before 4.15a/b): draft visibility, retention,
  recovery across authenticated sessions, offline/failure behavior and competing
  edits. Autosave is not signing; server entry time cannot be backdated.
- **Urgent escalation** (before 4.17a): direct contact, delivery failure,
  acknowledgment deadlines, fallback recipients and accepted response ownership.
  The notification bell and an in-app note alone do not constitute this workflow.
- **Review/order/result transitions** (before 4.16a, 4.18a/c and 4.20a): explicit
  per-type transition rules, cancellation/clarification reasons and clinical
  review gates. Do not copy one universal POC state machine into every domain.
- **Coverage acceptance** (before 6.1c): who may designate cover, how the
  recipient accepts, effective time and high-risk outstanding responsibilities.
- **Post-departure follow-up** (before 6.8a and 6.2a/e): responsible recipients,
  acceptance, due/escalation policy, permitted updates on closed encounters and
  administrative checkout/departure roles. Clinical readiness never auto-closes work.
- **Shared care** (decided 2026-11-02, by the person, under the simplicity decision): the
  primary technician is optional. A case without one shows "Not assigned"; no shared-pool
  record, placeholder person or extra model is added. A shared pool is revisited only
  when a clinic needs it.

## M2: ER Board and Patient Overview

Continue from the delivered board and 4.8e. Follow `reference/er-board-poc/`
(2026-11-02) and the person's decisions above; see that folder's README for
the source mapping and gaps. Demo data only. New read-only
drawers initially reuse the current team-member demo API; they do not claim
the future per-role protections in S.6/3.7 are already implemented.

**Documented assessments and safety data**

- [ ] **4.13b** `feature/documented-priority-summary` (phase 1, Patient Overview, after 4.3a): the Care Coordination card shows the staff-designated Next Care Action with its priority ("Not prioritized" when unset), its assignee or "Not assigned", and its state ("Overdue by 10 min" with a warning, "Due in 5 min", "Not scheduled"), or "No next action designated" with any legacy free-text note beneath as "Previously documented next-action note", styled as the prototype's Next care action block. Current location and care stage move to the patient header in 3.2c. Staff set priority and designate the Next Care Action in the Tasks and due items dialog, delivered by 4.3b. The overview card never shows the whole open-task list. A completed task does not imply clinical resolution.

**Deferred task history**

- [ ] **4.13e** `feature/task-assignment-history`: assigner tracking and reassignment history for tasks (deferred from 4.13a phase 1), with its own history model and migration, covering creator, assigner, reassignment, completion and review accountability on the shared task model.

**Door to doctor** (prototype: fourth stat card and its details)

- [ ] **2.16a** `feature/door-to-doctor-api`: record the moment a doctor first sees a case (per the decision) and add the shift average and the change from the last shift to the summary.
- [ ] **2.16b** `feature/door-to-doctor`: the stats strip's door-to-doctor figure and "↓ 4 min vs. last shift", the "Door to first doctor" details dialog (current and previous shift) and **Show waiting patients**, which filters the board to cases still waiting for their first doctor.

**Validated clinical alerts** (not prototype colours or fixed demo ranges)

- [ ] **4.14a** `feature/validated-vital-alerts-api`: after hospital approval of species/context-aware rules and their configuration, replace provisional demo flags with attributable validated read results and tests. Do not infer acuity or clinical resolution from a value or workflow stage.
- [ ] **4.14b** `feature/validated-vital-alerts`: after 4.14a, display only approved clinical significance with non-colour wording in permitted review surfaces; unknown/inapplicable context remains neutral. Do not copy the proof of concept's red values as clinical rules.

**Duplicates** (prototype: intake dialog)

- [ ] **4.7** `feature/duplicate-patients`: warn on likely duplicates (same name, species and owner) in the intake dialog; merge only if the decision says so.

**Notifications** (prototype: bell with a dot)

- [ ] **2.17a** `feature/notifications-api`: the notifications the decision names, read and unread, pushed through the hub.
- [ ] **2.17b** `feature/notifications`: the bell's dot and a list that opens from it.

**Patients page** (prototype: "Patients" in the rail)

- [ ] **4.6c** `feature/records-forms`: new and edit forms for patients and owners on the Patients page, in the prototype's form style, including choosing or clearing the owner.

**Typography** (separate approval from a behavioral prototype)

- [ ] **2.20** `feature/command-center-fonts`: confirm the intended staff typography before changing font assets/hosting; the behavioral POC does not override current readable sizes, 700 bold or 1px focus. If DM Sans/Manrope remain approved, choose a font package/host and test fallbacks, loading and realistic panel widths rather than copying tiny POC text.

## M3: Sign-in and roles

Production authentication needs the login-provider decision. Application-wide
identity/role items can run alongside M2 and gate real clinic data. The optional
Security Lab slice below can use the existing framework-backed demo sessions
in an isolated synthetic environment; it does not wait for enterprise identity,
staff invitations, full clinical order workflows or My Patients screens. The
portfolio Lab itself is not a mandatory clinic-launch prerequisite.

**Optional Security Lab portfolio MVP**

Source: `reference/security-poc/VETIFLOW_SECURITY_LAB_MVP_SPECIFICATION.md`
and `VetiFlow_Security_Lab_Focused_POC.html`; scope/review mapping in that
folder's README. Keep the current 3.6a work item intact. After it lands, this
slice may be explicitly prioritized with `/feature S.21a`; its position here
does not automatically interrupt the remaining ER queue.

The three-day outline is a timebox, not a promised delivery date. Prefer
verified enforcement and negative tests over extra UI. Build only protected
fictional reads, vitals recording, a bounded order-authorization scenario and
restricted security-event viewing; leave the other POC features Coming soon.

- [ ] **S.21a** `feature/security-lab-boundary`: after the Lab boundary decision, isolate the Lab to explicitly enabled development/test operation with a synthetic local/test database and trusted authenticated fixture identities. Reuse existing Account/StaffMember and framework authentication where appropriate; add a separate security-operator policy, not a clinical-role dropdown grant. Disable route/execution/event endpoints in production even with an enabling flag, and test direct access and actor/role spoofing. No production seeding or arbitrary URL/SQL/command runner.
- [ ] **S.21b** `feature/security-lab-events`: after S.21a, persist structured server authorization decisions with actual actor/role, action/resource, allowed/denied result, safe reason, UTC entry time and request/correlation ID. Capture middleware-level refusals too, including anonymous attempts, and distinguish allowed decisions from successful mutation. Provide operator-only event reads; deny clinical roles, including default manager access. No tokens, credentials or unnecessary clinical text; follow migrations/RLS rules for any model changes.
- [ ] **S.21c** `feature/security-lab-protected-actions`: after S.21a/b, implement the minimal scoped fictional scenarios: permitted full clinical read versus restricted approved coordination status, vitals entry and valid draft-order authorization. Resolve identity/role on the server, use actual domain IDs and isolated data, and enforce the illustrative demo matrix. Integration tests prove 401, 403, allowed persistence, denied clinical-data non-mutation, persisted allow/deny events, invalid/stale order checks and production exclusion. Reuse existing vitals/domain code where safe; a fixture order is explicitly not clinical authorization for 4.18/4.19.
- [ ] **S.21d** `feature/security-lab-console`: after S.21a-c, connect a separate operator-restricted development-only Lab surface to real responses/events, with no ER Board/My Patients tabs or normal clinical navigation entry. Show actual HTTP outcomes and backend state; failure cannot fall back to simulated success. Any scenario identity control follows S.21a's trusted-session/harness design, never client role claims. Mark unbuilt features Coming soon and keep the original HTML clearly identified as a simulation reference.
- [ ] **S.21e** `docs/security-lab-evidence`: after S.21c/d, produce repeatable local/CI integration scenarios, a concise threat model, sanitized actual-response/test report and isolated-demo instructions/recording. Prove operator-only event access, no denied clinical mutation, no production execution routes and real audit persistence. Explicitly separate implemented controls, simulations and remaining limitations. Do not report S.5/S.6/8.1/8.8 or the launch gate complete based only on this slice.

**Application-wide identity and clinical authorization**

- [ ] **S.5** `feature/auth-login`: staff login (provider per the decision, building on or replacing the proof of concept), secure cookies or short-lived tokens, logout, CSRF protection if cookies are used; every endpoint requires a signed-in user by default.
- [ ] **S.15** `feature/staff-accounts`: invite a staff member, link the account to a `StaffMember`, deactivate (blocks sign-in at once), and account recovery per the provider.
- [ ] **S.6** `feature/auth-roles`: enforce the approved field/action permission matrix for Veterinarian, Technician, Assistant, Receptionist and Manager/supervisor responsibilities, using existing staff roles where applicable and separate owner-account scope. Reuse proven S.21 policies/tests where applicable, then add assignment, privileges and clinical context across the actual application APIs. A Lab-only denial does not protect an unchanged clinical route. Restrict reads/writes/client-note approval independently; blocks 3.7 and mixed-role rollout as well as real clinic data.
- [ ] **S.7** `feature/hub-authorization`: require sign-in on the SignalR hub, pass the token safely, broadcast IDs only.
- [ ] **S.14** `feature/session-timeout`: short idle timeout and a quick lock for shared ER workstations.
- [ ] **S.9** `feature/rate-limiting`: ASP.NET Core rate limiter on login, writes and AI endpoints [19].

## M3b: Shared clinical foundation and both My Patients workspaces

The veterinarian and technician specifications/POCs are now supplied. This
replaces the missing-design hold on 2.22a/b. Both workspaces use one encounter
record, common shell/queue and shared service contracts; the server decides
permitted reads/actions. The objects named in the handoffs are conceptual:
reuse EmergencyCase, Patient, StaffMember/Account, CaseTask, Handoff and their
history rather than creating duplicate Encounter/StaffUser tables per page.

My Patients starts with a secure queue and read-only chart (2.22a-d) after S.6 and 4.3a; review requests, escalations, orders, diagnostics and drafts are added incrementally and do not block it (2026-11-02 simplicity decision).

Role-restricted reads/actions require S.6 and the applicable policy decisions;
production use also requires S.5/S.7 and the full launch gate. Incremental work
may use the existing authenticated demo with synthetic records and honest
unsupported states, as the security-gates-real-data decision allows. This does
not substitute for production identity, privileges, signatures or urgent
notification delivery. New models ship migrations, role/transition tests and
truthful unsupported/empty/error states. Split any oversized item before its
feature spec is approved. Keep prototype defects in the reference READMEs;
correcting those artifacts is a separate /fix, not an implicit product build.

**Shared reliability and audit, before editable clinical workflows**

- [ ] **2.4** `feature/board-data-loading`: prevent case/refetch races across ER and the two workspaces; keep the last good data on errors, and preserve case-bound drafts during same-case refreshes. A queue filter must not silently replace the selected chart [22, 23].
- [ ] **2.5** `feature/live-connection-status`: retry hub connections, refetch on reconnect, and show Reconnecting/Offline or stale documented state across shared views. Do not automatically replay a clinical write or claim old observations are current [21].
- [ ] **2.2** `feature/case-concurrency`: add the case xmin token and clear current-state conflicts; new note/order/administration features also supply their own record/version guards so unrelated clinical writes do not silently overwrite each other [12].
- [ ] **8.1** `feature/audit-log`: authenticated view/change history, permitted manager reads and traceable actors/source records, without clinical text or contact details in ordinary logs. Reuse S.21 event infrastructure where appropriate but keep operator-only Lab security events distinct from manager-visible clinical audit. Establish the application-wide audit boundary before clinical drafts, signing, orders and administrations; each feature adds its own event/version evidence. Never derive competency/productivity rankings.

**Permission-filtered shared overview** (requires S.6)

- [ ] **3.7a** `feature/er-overview-projection`: after S.6 and the field/action permission decision, provide minimal server-authorized operational, Clinical, Medications and Timeline read projections for each permitted role. Do not send raw intake/clinical notes to reception and hide them only in React. Test role-by-field denial as well as signed-out and owner refusal; preserve the privileged demo behavior until replacement contracts are ready.
- [ ] **3.7b** `feature/role-safe-er-overview`: use 3.7a's permitted views and explicit unavailable/denied states, including reception's route to the attending clinician. No demo role dropdown as an authorization mechanism. Roll out mixed-role review only after these server contracts and policies exist.

**Shared clinical APIs needed by the role read models**

- [ ] **4.15a** `feature/clinical-drafts-api`: after the draft policy and reliability/audit foundation, persist encounter-bound veterinarian exam/plan and technician nursing drafts with author/entered/event times, revision conflicts, secure authenticated recovery and permitted visibility. No clinical browser-storage persistence, automatic normal findings or implicit signing.
- [ ] **4.16a** `feature/clinical-review-requests-api`: separate review requests from tasks and orders, link the underlying concern/observation/task, and enforce requested/acknowledged/clarification/reviewed/resolved/cancelled transitions per policy with actors, times and history. The sender cannot assert someone else's receipt or authorization; completed care does not resolve the concern.
- [ ] **4.17a** `feature/clinical-escalations-api`: after the escalation policy, record explicit urgent concerns, intended/fallback recipients, delivery/receipt state and response ownership/disposition separately from routine review. Direct-contact/failure/timeout behavior must be validated; an in-app save or bell does not prove emergency delivery or resolution.
- [ ] **4.18a** `feature/clinical-order-drafts-api`: persist typed diagnostic/treatment/medication order drafts with encounter identity, author, version/history and permitted draft modification/cancellation. Actual required fields/transitions follow the order-type policy; a draft is not a prescription or active administration authority. Authorization is 4.18c.
- [ ] **4.19a** `feature/medication-reconciliation-api`: maintain a shared current/home medication history and explicit unknown/reported/verified reconciliation with source, verifier and time. Preserve legacy text as unverified; never infer no medications from an empty list. Keep orders and actual administrations distinct.
- [ ] **4.20a** `feature/diagnostic-results-api`: after 4.18a, link diagnostics to real encounter/order records; track specimen/process/result availability and clinician interpretation separately, with a named follow-up owner and event/entry times. A completed collection task does not close a result awaiting interpretation. Do not fabricate result values or reviewed states.

**Common My Patients shell, queues and role read views**

- [ ] **2.22a** `feature/my-patients-api`: after S.6 and 4.3a, provide role-authorized server reads for the My Patients queue ("Assigned to me" and "All active", per the Role queue rules decision) and the read-only chart, from the existing case, task, vitals, timeline and assignment records. Counts are distinct patients. Review requests (4.16a), escalations (4.17a), orders (4.18a) and diagnostics (4.20a) join these reads when they are built; none of them blocks this item, and 3.7a (role-filtered ER overview) is not required for the clinical workspaces. No hardcoded clinician name or page-owned copy of status; coverage eligibility extends through 6.1c.
- [ ] **2.22b** `feature/my-patients`: retain this existing ID for the common shell and one Patient Queue/wide chart scaffold using 2.22a. Share the ER header/active navigation, three neutral metric filters, acuity badges beside names, search/clear and assigned/all-active controls. Apply 4.8h protection to selection/navigation, preserve selected context when filtered, and test readable phone/tablet layouts. No fourth draft metric or extra attention sidebar; activate navigation only for authorized delivered views.
- [ ] **2.22c** `feature/veterinarian-patient-chart`: after 2.22b, add the read-only veterinarian chart from records that exist: Clinical overview, Tasks, Timeline and Discharge status. Exam & plan, Orders, review requests, escalations and diagnostics appear as their items (4.15-4.20) are delivered; until then the chart says they are not available yet rather than showing an empty or complete section. Editing and actions arrive in the features below.
- [ ] **2.22d** `feature/technician-patient-chart`: after 2.22b, add read-only Care overview, Vitals & observations, Care tasks, Medications, Vet review requests, Handoff & escalation, Timeline and Discharge prep using the same sources. Keep role-appropriate controls and states; no technician diagnosis/prescription/medical-discharge authority or duplicate patient model.

**Documentation, observations, review and escalation actions**

- [ ] **4.15b** `feature/clinical-draft-editors`: after 4.15a and 2.22c/d, provide veterinarian exam/plan and technician nursing draft editing with server autosave/explicit save, visible pending/saved/failed/unsigned states and recovery. Snapshot the encounter/input before debounce; flush or protect pending changes on patient/tab/filter/route changes. Test a switch within 450 ms and failed/offline/concurrent saves; never write a draft into the newly selected patient's chart.
- [ ] **4.11c** `feature/technician-observations`: after 4.11a/b and 2.22d, adapt the authorized vitals/observation form to measured versus entry time, actual recorder/performer and assessed/not-assessed/missing states. Preserve reviewed-new-set semantics unless an explicit per-observation history change is approved. Never copy older missing readings into a new measurement timestamp; no normal-value autofill or acuity change.
- [ ] **4.16b** `feature/technician-review-requests`: after 4.16a and 2.22d, create and track permitted requests linked to actual findings/tasks; show intended recipient, urgency, event/entry time and receipt/review state. Recording a request does not impersonate clinician acknowledgment or authorize treatment.
- [ ] **4.16c** `feature/veterinarian-review-actions`: after 4.16a and 2.22c, acknowledge receipt, request information, document review and resolve/further-action separately according to server policy. Keep nonresolved requests in accurate patient counts and preserve the originating concern/history.
- [ ] **4.17b** `feature/technician-escalation`: after 4.17a and 2.22d, record urgent concerns with recipient, direct-contact actions and visible unconfirmed/failed-delivery states. Guide the validated immediate escalation/fallback process rather than presenting a saved note as a delivered alert.
- [ ] **4.17c** `feature/veterinarian-escalation-response`: after 4.17a and 2.22c, display escalations prominently, record receipt separately from clinical response/transfer/resolution, and maintain accountable ownership. Keep unresolved escalation patients in Needs my attention even if every related task is complete.
- [ ] **4.13c** `feature/clinical-task-performance`: after 4.13a/b and both chart views, provide permitted task assignment/reassignment/performance documentation with actual performer, entered/event times and history. Task completion and a subsequent review/escalation remain separate; technician coordination tasks cannot authorize veterinarian-only care.

**Signing and authorized orders**

- [ ] **4.15c** `feature/clinical-note-signing-api`: after S.5/S.6, 8.1, 4.15a and approved signing rules, sign an authenticated immutable note version; distinguish entered, examined/performed, reviewed and signed actors/times. Corrections are audited addenda/amendments, not edits to a signed snapshot. Record evidence without claiming the browser demo implements a legal signature.
- [ ] **4.15d** `feature/clinical-note-signing`: after 4.15c and the draft editors, expose only permitted sign/review/addendum controls, clear unsigned/pending/error states and version history. Pending autosave must not silently overwrite a signed record or re-create an unsigned draft from the signed content.
- [ ] **4.18b** `feature/veterinarian-order-drafts`: after 4.18a and 2.22c, create/modify/cancel permitted typed order drafts with the approved structured fields and visible draft identity; no implied prescription or authorization. Link tasks/results to real order records.
- [ ] **4.18c** `feature/clinical-order-authorization-api`: after 4.18a, approved authority rules and audit/version foundations, authorize a precise order version and enforce active/held/discontinued/superseded transitions per order type, including reasons and downstream invalidation. Test competing edits and state changes; execution completion and results review remain distinct.
- [ ] **4.18d** `feature/veterinarian-order-actions`: after 4.18c and 2.22c, display current order version, authorizer/state/time and permitted authorization/hold/discontinue/amendment actions. A modified draft needs new authorization; successful documentation alone is not execution or interpretation.

**Medication reconciliation, administration and diagnostic review**

- [ ] **4.19b** `feature/medication-history-views`: after 4.19a, use one role-filtered source in both workspaces and the ER Medications drawer. Distinguish reported/verified/unknown home history, active orders, administrations and amendments with actual units/time/source; do not invent a medication ledger from free text.
- [ ] **4.19c** `feature/medication-administration-api`: after 4.18c, S.6 and the administration policy, require the selected patient's current verified active authorized order/version and permitted staff identity. Record given/held/refused/not-given/partial or incident outcomes as applicable, required reasons, actual performer/time, entry actor/time and amendments. Enforce holds/discontinuations, duplicate/conflict protection and audit atomically; clients cannot substitute drug/dose/route or self-authorize.
- [ ] **4.19d** `feature/technician-medication-administration`: after 4.19c and 2.22d, block entry without suitable authority; show order/patient/authorizer and read-only authorized drug/dose/unit/route/schedule, configured checks and clarification paths. Capture permitted outcomes and event time truthfully, handle stale order/conflict/failure without automatic duplicate submission, and update the shared MAR.
- [ ] **4.20b** `feature/diagnostic-review-views`: after 4.20a and both charts, show pending collection/process/result/interpretation states and named follow-up ownership; authorized clinician review is distinct from technician collection completion. Keep unresolved results visible after task completion and carry them into discharge/follow-up checks.
Discharged cases are found through the patient, not a separate Discharges page (re-planned 2026-11-01 from `reference/VetiFlow_Patient_History_Access_Recommendations.md`, since removed; the outcome is in the 4.21a-d history). The 2026-11-01 discharge rule stays: the Discharge stage takes a case off the board; pickup and departure stay with 6.2e. For the demo any signed-in team member may read visit history, the same access as a case's detail today; S.6 narrows it later. Owners reach none of it.

**Handoff** (prototype: "Handoff" button)

- [ ] **6.1a** `feature/handoffs-api`: extend the existing Handoff model with actual sender/recipient, event/entry times, unresolved work and an auditable receipt/acceptance lifecycle. Only permitted receiving actors can assert acknowledgment; a sent message does not transfer responsibility or resolve concerns. Preserve the case/task history; AI drafting remains 5.5.
- [ ] **6.1b** `feature/handoffs`: after 6.1a and both role charts, share handoff entry/review controls with visible unconfirmed/received/accepted states and outstanding ownership. Keep routine handoff distinct from urgent escalation (4.17), and reuse the same records in Timeline and permitted ER review.
- [ ] **6.1c** `feature/clinical-coverage-api`: after 6.1a, the coverage-acceptance policy and 4.3a, store attending versus temporary covering responsibility, recipient acceptance/effective time and coverage history separately. Extend queue eligibility/read projections to accepted cover without rewriting original author/performer or silently changing attending ownership.
- [ ] **6.1d** `feature/clinical-coverage`: after 6.1c, show attending/covering/technician-pool context in permitted role charts and ER summary. Record handoff proposals, receiver acceptance and effective responsibility; high-risk unresolved work remains attributed until the accepted transition.

**Pet parent contact and approved communication**

- [ ] **6.4a** `feature/owner-contact-api`: record each contact's event and entry times, communicator, channel and outcome, keeping the next client-update task in step. Contact attempts, completed communication and approved wording are different facts; `LastOwnerUpdateAt` alone does not prove an approved update. Contact details never reach the board list.
- [ ] **6.4b** `feature/owner-contact`: authorized contact logging through the approved workflow, with last recorded communicator/time and next planned update in the summary. No record means "No communication recorded," not proof that the family was never contacted; routing to the attending clinician remains clear.
- [ ] **6.5a** `feature/approved-client-updates-api`: after 6.4a, S.6 and the approval/escalation decision, store client-facing text with its author, approver, status and approval/event times; enforce recipient/role scopes on the server. Internal notes and preliminary diagnoses are not automatically converted into approved wording. This shared source also feeds the later owner page.
- [ ] **6.5b** `feature/approved-client-update-summary`: after 6.5a and 3.7, show the latest authorized approved note, communicator/time and next update in the ER summary; if none, say "No approved client-facing update recorded." Approved authoring/review belongs in the appropriate clinical/communication workflow, separate from reception read access.

**Follow-up ownership and staged discharge**

- [ ] **6.8a** `feature/clinical-followup-api`: before discharge authorization, persist linked unresolved result/concern, named responsible staff/team, acceptance, follow-up plan/due/response state and history according to policy. Keep authorized follow-up reads/updates available after departure without reopening the ER census or allowing unrelated discharged-case edits.
- [ ] **6.6** `feature/case-history`: after S.6 and the shared chart/read contracts, list/search permitted departed encounters and reopen their documented history read-only, with an approved follow-up access route. Reuse the role chart/Timeline or existing record navigation rather than a second patient model; signed history stays immutable and only 6.8 endpoints permit bounded follow-up updates.
- [ ] **6.8b** `feature/clinical-followup-views`: after 6.8a and 6.6, show outstanding responsibility and disposition in the role charts, discharge review and permitted history/follow-up access. Departed patients do not count as active census patients. Do not hide pending results because a patient left the active board or infer accepted ownership from sending a request.

**Discharge**

- [ ] **6.2a** `feature/discharge-api`: after S.6, signing/authorized-order foundations, 6.8a and the outcome/clinical-policy decisions, record authenticated medical readiness/authorization against reviewed instructions and actual unresolved follow-up ownership. Preserve signed/versioned evidence and history; readiness does not set departure, remove the census card, release a room or complete tasks.
- [ ] **6.2b** `feature/discharge`: after 6.2a and the veterinarian chart, review readiness, approved instructions/prescriptions and outstanding responsibility before the permitted clinical authorization action. Show authorization separately from preparation, checkout and physical departure; no single demonstration checkbox as authority.
- [ ] **6.2c** `feature/discharge-preparation-api`: after 6.2a, record permitted technician preparation and education against the approved instruction version, including actual actors/event/entry times, owner questions and incomplete preparation. These records cannot grant medical authorization or departure authority.
- [ ] **6.2d** `feature/technician-discharge-preparation`: after 6.2c and the technician chart, prepare approved materials, record education/questions and coordinate checkout while medical authorization remains veterinarian-only. Outstanding clinical issues keep their named follow-up owner.
- [ ] **6.2e** `feature/encounter-departure-api`: after approved outcome/departure policy and 6.2a/c, record actual departure/terminal outcome with permitted actor/time. Update board/summary filters and active-case/room indexes coherently; only the approved event changes census/occupancy. Home departure, admission, transfer, death and euthanasia follow distinct defined semantics; follow-up history remains actionable.
- [ ] **6.2f** `feature/encounter-departure`: after 6.2e and an approved administrative checkout/departure surface, distinguish checkout, awaiting pickup and confirmed departure; reflect the final state across both workspaces and ER without implying all concerns are resolved. Do not invent a reception page from the clinical POCs.

## M4: The rest of the rail

The rail's other destinations need their own approved requirements/design
references. Reuse the design system and shared services, not the ER proof of
concept as a substitute for another page's content or workflow.

- [ ] **2.18** `feature/overview`: the Overview page (contents to be designed; needs a design in `blueprint/reference/` first).
- [ ] **2.19** `feature/reports`: the Reports page (contents to be designed; needs a design first).
- [ ] **2.8** `feature/timer-escalation`: wait times turn amber and red past per-acuity thresholds from clinic settings [24].

## M5: Administration, history and reliable live behaviour

- [ ] **9.3** `feature/clinic-settings`: clinic name, shift hours and timer thresholds (the Settings page; feeds 2.15 and 2.8).
- [ ] **9.1** `feature/staff-admin`: managers add, edit and deactivate staff members and their roles.
- [ ] **9.2** `feature/room-admin`: managers add, rename and retire rooms; a room with an active case can't be retired.
- [ ] **6.7** `feature/case-corrections`: correct or reopen a discharged case per the decision, with a `CaseEvent` for each change.

## M6: Private owner experience

- [ ] **S.8** `feature/owner-access-control`: owners see only their own pet's case (resource-based checks, no guessable links); access expires and staff can revoke it. Replaces the demo pet parent sign-in for production.
- [ ] **6.3** `feature/owner-page`: after S.8 and 6.5a/b, the private owner page consumes the same authorized approved communication source, with client labels and no raw staff notes. Replaces the demo pet parent home; requires its own page requirements/design.

## M7: Launch gate and pilot

All of these must be done before VetiFlow holds real clinic data.
The identity/role, reliability and audit foundations moved earlier for the
clinical workspaces remain launch requirements; moving 8.1 does not waive it.

- [ ] **8.10** `chore/demo-environment`: a separate Render service and Supabase project with demo data only; Vercel previews point at demo. Demo sign-in exists only there.
- [ ] **7.4** `feature/demo-mode`: Reset demo button, scheduled reseed and a write rate limit, in the demo environment only [19, 20].
- [ ] **S.10c** `chore/app-role-cutover`: switch Render's API connection to the `vetiflow_app` login (password set in Supabase), as planned in S.10b's deploy notes.
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
- [ ] **7.9** `test/board-session-ended-test`: only when it is needed, restore the `ErBoardPage.test.tsx` test "sends the person to sign in when the session has ended" (`/api/cases` returns 401: the board goes to sign-in with `sessionEnded` and clears the stored token). It was removed on 2026-10-29 in 2.21a's branch after it timed out in 3 of 4 full Verify runs (1322-1543 ms against `findByText`'s 1000 ms wait; it passed alone). Find why that first render is slow under load before bringing it back. Until then, the summary's 401 test in the same file still covers the redirect.

## Dropped

- **4.13d** `feature/next-care-action-selection`: dropped 2026-11-02. Automatic ranking and selection of the next care action were rejected; clinical priority and the Next Care Action are set by authorized clinical staff (see Decisions).
- **4.8f** `feature/inline-pain-score`: superseded before implementation by the 2026-10-30 ER Overview requirements, which explicitly exclude a generic 0-10 pain slider. Unsaved-change protection is retained as 4.8h; species-specific clinical assessment awaits the separately approved My Patients workflow. The delivered 4.8a-e history is retained.
- **6.5** `feature/owner-updates`: split before implementation into 6.5a/b, a shared approval source plus the staff communication summary; the owner page consumes that source rather than implementing a second approval model.

- **2.1** `feature/stage-update-rules`: merged into 4.9a (decided 2026-10-28, stages change through Update status).
- **2.6** `feature/drag-and-drop`: dropped 2026-10-28; the prototype's lanes are acuity, not stages.
- **2.7** `feature/keyboard-stage-menu`: dropped 2026-10-28; Update status (4.9b) is the way to change a stage, by mouse or keyboard.
- **3.3** `feature/card-details`: covered by the prototype's cards (2.11b) and tags (3.5).
- **7.1** `test/integration-tests`: delivered by 1.2; new items add their own API and database tests.
- **4.10a** `feature/case-schedule-api` and **4.10b** `feature/case-schedule`: merged into 4.4a and 4.4b (decided 2026-10-28, due items are tasks).
