# VetiFlow — Veterinarian My Patients

**Development handoff and functional specification**  
**Page scope:** Veterinarian / clinician-facing **My Patients** only  
**Status:** Agreed UX direction + implementation recommendations + items requiring clinical validation  
**Reference prototype:** `VetiFlow_Veterinarian_My_Patients_Enhanced_POC.html`  
**Date:** October 30, 2026

> **PROOF OF CONCEPT — NOT A PIXEL-PERFECT DESIGN SPECIFICATION.**
> The HTML illustrates interactions, hierarchy, and sample workflows. Do **not** recreate its markup or clinical examples verbatim. Match the existing VetiFlow design system and the established ER Overview visual patterns. All patient details, clinical values, counts, staff identities, authorizations, and timestamps in the demo are fictional.

## 1. Purpose and product boundary

**My Patients is the veterinarian's primary working environment.** During a busy ER shift, the veterinarian is likely to work here much more than on ER Overview. The page must support rapid recognition of which patient needs a decision, review, or follow-up, followed by direct access to charting and authorized actions.

**ER Overview** is a separate shared, read-mostly hospital coordination screen for doctors, technicians, supervisors, and permitted front-desk users. **My Patients** is the deeper role-focused clinical workspace. Both access the **same longitudinal patient record**: updates made in My Patients should populate shared views where appropriate. Do not build independent duplicate records.

This document specifies the **veterinarian view**, not the technician My Patients experience. The two will ultimately share patient, task, order, audit, and timeline infrastructure but differ in relevant controls, defaults, and permissions.

### Success criteria

1. A veterinarian can identify assigned patients and outstanding veterinarian work at a glance.
2. An actionable summary filter narrows **one** patient queue rather than creating a competing task queue.
3. Selecting a patient makes the chart immediately usable, with minimal navigation.
4. Clinical writing is interruption-tolerant: draft save, unsaved-change protection, late entry semantics, and explicit signing.
5. Veterinarian review/acknowledgment, clinical authorization, task completion, and clinical resolution are different recorded events.
6. The interface does not imply undocumented care was never performed, or that a displayed value is real-time when it may be old.
7. Critical / Urgent / Stable appear consistently near patient names throughout VetiFlow.

## 2. Canonical layout

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ VetiFlow / My Patients         Search patients…  Notifications  User    │
├─────────────────────────────────────────────────────────────────────────┤
│ Northside Veterinary Emergency                           Shift · Intake │
│ Live patient flow and care coordination                                 │
│ [ER board] [MY PATIENTS — ACTIVE]  Shared patient record ...             │
├─────────────────────────────────────────────────────────────────────────┤
│ [My active patients] [Needs my attention] [Review requests]             │
├───────────────────────┬─────────────────────────────────────────────────┤
│ PATIENT QUEUE         │ SELECTED PATIENT CHART                          │
│ Assigned / All active │ Name [ACUITY] · stage · location · team         │
│ Search / clear filter │ [Clinical overview] [Exam & plan] [Orders]      │
│                       │ [Tasks & reviews] [Timeline] [Discharge]        │
│ Milo [CRITICAL]       │                                                 │
│ Next vet action       │ Role-appropriate patient record / actions      │
│ Additional indicators │                                                 │
│                       │                                                 │
│ Luna [URGENT]         │                                                 │
│ Biscuit [STABLE]      │                                                 │
└───────────────────────┴─────────────────────────────────────────────────┘
```

**Layout decision:** One left-side **Patient Queue**, one larger right-side **Selected Patient Chart**. **Remove the standalone “Needs your attention” sidebar entirely**; it previously duplicated patient items and stole width from documentation. Desktop target is approximately **30% queue / 70% chart**, subject to minimum readable widths and responsive design. At narrow widths, a queue-then-chart navigation pattern or stacked layout is preferable to squeezing clinical fields.

## 3. Shared header and visual consistency — agreed

The page header must match the existing **ER Overview** header, including:

- Top application bar with VetiFlow breadcrumb, patient search, notification access, and signed-in clinician profile.
- Main heading **Northside Veterinary Emergency**.
- Subtitle **Live patient flow and care coordination**.
- Day-shift / staff indicator and **New intake** affordance (functional details belong to shared app architecture).
- Visible navigation tabs **ER board** and **My patients**, with **My patients** active on this page.
- In the stand-alone demonstration, ER board navigation may be disabled because its own prototype exists. In production, the tabs must navigate normally and preserve the shared application shell.

**Metric card style must match ER Overview exactly in spirit**: white surfaces, subtle borders and shadows, same typography/spacing/radii, **thin teal selected outline** and small **ACTIVE** indicator. Avoid the earlier filled mint selected-card background or overly thick teal outline. The active patient card likewise uses a white card, thin teal outline, slight highlight/shadow, and existing ER Overview radii.

**Acuity placement:** show text-labeled **Critical, Urgent, Stable** badges **beside each patient's name**, both in the queue and selected chart. A subtle left-edge accent may help scanning but must never be the only severity cue. Keep **acuity separate from workflow urgency** (overdue, needs review, waiting for a decision). Do not assume Stable means no work, or Critical means the task itself is overdue. Thresholds and severity definitions are hospital-configured and clinically validated.

## 4. Three clickable metric cards — agreed

| Card | Meaning | On click | Important rules |
|---|---|---|---|
| **My active patients** | Active patients assigned to this veterinarian | Show assigned-patient queue; default chart opens Clinical overview | Count patients, not tasks; selected style matches ER Overview. |
| **Needs my attention** | Distinct assigned patients with open veterinarian-owned decisions/actions | Filter the **same queue** to these patients; selected chart opens Tasks & reviews | Count **patients**, not task volume. Prioritize valid veterinarian work; do not include every technician action. |
| **Review requests** | Distinct assigned patients with pending veterinarian review requests | Filter same queue; open Tasks & reviews on selected patient | Separate review-request state from work completed and authorization. |

- Do **not** retain a permanent fourth “Draft documentation” metric card.
- Show an **Unsigned draft** flag on the relevant patient card instead.
- Provide an obvious **Clear filter** path. Highlight the active metric using ER Overview selection styling.
- Combine metric filter + queue search + Assigned to me / All active in understandable, deterministic ways; show active constraints and an informative empty state.
- The POC uses `My active patients`, `Needs my attention`, and `Review requests`. Its example counts must not be treated as acceptance-test constants.
- **Implementation refinement:** clearly define whether All active is available while My active patients is selected; avoid contradictory state. Proposed behavior: changing to All active clears assigned-only metric filtering or clearly explains why the metric applies only to assignments.

## 5. Patient Queue — agreed

The queue is the veterinarian's **single prioritization surface**. Each patient entry should expose, at minimum:

1. Name + nearby acuity badge (consistent with ER Overview).
2. Species/breed where known; brief presenting complaint.
3. Current documented care stage and location.
4. **Next veterinarian-relevant documented action**, with owner, status, and due time when known.
5. A compact indicator for additional outstanding actions and/or veterinarian review requests.
6. **Unsigned draft** indicator where applicable.
7. Last-updated context when information may be stale (proposed addition).

**Do not** replicate the entire task list inside the queue. One meaningful actionable summary per patient is enough; detailed tasks belong in the chart. Never infer clinical priority merely from total task count.

### Filtering and selection

- Default to **Assigned to me**.
- Support **All active** subject to clinician permission and department policies; show clearly when viewing another clinician's patient.
- Search by patient name and appropriate case metadata. Search and filter must not silently remove all selection context; either keep selected chart or explicitly show a select-a-patient state.
- Select a patient to load its chart without leaving My Patients.
- Active metric determines initial chart section: **Clinical overview** for default; **Tasks & reviews** for attention or review requests.
- On reassignment, preserve task history and performed-by records. Reassignment should update the current queue membership without rewriting historical ownership.

### Attention ordering — proposed

Use a configurable clinical-work ordering such as flagged safety concerns requiring authorized response, due veterinarian decisions, pending review requests, reassessments, then other routine work. Sort order should be transparent and manually adjustable; don't equate elapsed time or documentation latency with staff competence.

## 6. Selected Patient Chart — agreed tabs

### 6.1 Clinical overview

Purpose: succinct clinical context before acting. Display presenting complaint and brief clinical summary, latest recorded HR/RR/temperature/SpO₂ (where recorded) **with actual measurement time and units**, allergy status, attending veterinarian, participating technician, current care stage/location, next *documented* action, scheduled reassessment, and communication context as authorized.

**Data integrity rules:**

- Unrecorded is not normal. Never auto-populate normal MM, CRT, mentation, hydration, etc.
- Blank findings and explicitly documented “not assessed” are different states.
- Alert styling for vitals must follow validated species- and context-specific hospital thresholds; the POC's colored values are examples, not clinical decision support.
- Measured timestamp, entry timestamp, and author must be preserved independently. A value displayed in the chart is **latest recorded**, not guaranteed current.
- The overview summarizes existing data; no parallel source of truth should be maintained.
- Advanced clinical findings can live in deeper clinical sections and chart history rather than cramming them into this summary.

### 6.2 Exam & plan

Purpose: document examination, findings, clinical assessment/differentials, medical decision-making and care plan.

**Required UX:**

- Low-friction structured fields plus narrative free text.
- Save **unsigned draft**, clearly marked as such.
- Support authorized **sign-off**, with verified identity, timestamp, immutable audit, and addenda/amendment workflow.
- Protect unsaved work when switching patients, tabs, or losing connection (autosave/recovery is a recommended product feature, not implied by the demo).
- Support interrupted care and late entry without falsifying the original event time.
- Use explicit identity for who entered text, who examined the patient, who reviewed it, and who signed.
- Clinical writing should not be required before the veterinarian can access urgent chart data.

POC disclaimer: “Record sign-off (demo)” does **not** implement real medical record signing.

### 6.3 Orders

Purpose: create, review, authorize, modify, discontinue, and track diagnostics/treatment/medication orders according to role.

Separate at least **draft**, **pending authorization** (if applicable), **authorized**, **in progress**, **completed**, **held**, and **canceled** as clinically appropriate; do not overfit one universal state machine to every order type.

Potential order attributes: type, instructions, dose/route/frequency when applicable, urgency, ordering veterinarian, creator, authorization record, performer, entered and effective timestamps, linked patient/encounter, status, results, and amendments. Medication prescribing/administration privileges, controlled substances, pharmacy verification, and state/local rules must be validated with hospital policy and veterinary compliance experts.

**Important:** Creating an order draft is not a legally valid prescription or authorization. The POC modal is illustrative only.

### 6.4 Tasks & reviews

Purpose: coordinate work and close the loop on clinical requests.

Support:

- Veterinarian-created tasks assigned to authorized technicians or other staff.
- Technician-created **review / sign-off / clarification requests** routed to an authorized veterinarian.
- Clear task **owner**, creator, assigner, performer, due/priority, status, and history.
- Review requests distinguish **requested**, **acknowledged**, **reviewed**, **resolved / further action**, and **authorized** where appropriate; acknowledgment alone is not clinical sign-off.
- **Task completed ≠ clinical concern resolved.** Example: a technician measures abnormal respirations and completes the recording task, but a clinician still needs to assess the abnormal finding.
- Flexible staff assignment models: primary technician, shared pool, rotating technician, multiple participants. Assigned-to and performed-by are distinct.
- Avoid using task counts, throughput, delays, or task history as simplistic staff competency/productivity scores. Support safety, communication, handoff, audits and training instead.

**Current POC limitation:** an “Acknowledge” or “Mark done” button is a demo simplification. Production requires role-specific transitions and permissions.

### 6.5 Timeline

A chronological **longitudinal patient encounter** with relevant clinical observations, vitals, assignments, orders, medications, task completions, communications, sign-offs, and discharge events. Attribute each event; distinguish occurrence time and time entered. Corrections are additive/audited, not silently overwritten. Provide useful filters without losing critical context.

### 6.6 Discharge

The veterinarian's section supports clinical discharge readiness and authorization; discharge is **not** one button that immediately removes the patient from the hospital.

Recommended workflow:

1. Veterinarian reviews medical readiness, diagnoses, outstanding diagnostics, and follow-up ownership.
2. Veterinarian approves clinically appropriate instructions and prescriptions.
3. Authorized technicians prepare medications and explain home care to owner; document communication and questions.
4. Reception completes financial/admin checkout as appropriate.
5. Authorized staff records physical patient departure time; only then is the case removed from the active ER census.

Distinguish **Discharge planned**, **Medically ready / discharge authorized**, **Preparing discharge**, **Awaiting pickup**, **Physically discharged / encounter closed**. Exact names are proposed; configure to local workflow. Maintain separate encounter outcomes for inpatient admission, transfer, death, and euthanasia.

**Safety gate:** open laboratory results, pending imaging interpretation, or other unresolved issues require explicit follow-up ownership/plan rather than auto-closing all tasks. The demo checkbox is not a production authorization mechanism.

## 7. Working in a real, fast-moving emergency service

The workflow must acknowledge that care can precede documentation, and the ER team may shift from one emergency to another before entering all details.

- Prefer existing chart events as inputs to generated status, not extra mandatory “update dashboard” steps.
- Distinguish **last recorded** from **currently happening**.
- Do not mark tasks completed solely because another workflow progressed.
- Allow concise entries at bedside and comprehensive notes later, with auditable event and recording times.
- Offer save-and-return, drafts, clear pending-signature badges, and optional recovery of unsaved input.
- Avoid distracting interruptive modals during emergencies when safe inline editing is possible.
- Never automatically produce clinical diagnoses, indicate a medical concern is resolved, or fabricate a next clinical decision.
- Patient work should remain accessible even while notes are incomplete, subject to genuine safety and authorization safeguards.

## 8. Cross-role sharing, permissions, and front-desk boundaries

**Single source of truth:** A documented action in the veterinarian chart should update corresponding shared patient status on ER Overview and the authorized technician view. Examples: assignment change, clinician review completion, vitals recorded, order issued, discharge readiness.

**Permission principles:**

- Role-based and configurable per hospital; actual clinical privileges require local policy and legal review.
- Authorized veterinarians may create/sign medical assessments, diagnoses, prescriptions, clinical discharge approvals.
- Authorized veterinary technicians may record nursing findings, medications performed under permissible authorization, monitoring, task progress, and requests for clinician review.
- Front-desk staff should see stage of care, location as appropriate, care-team contact, last owner update, planned follow-up communication and **approved client-safe notes** — not unrestricted internal clinical findings.
- Separate **created by**, **assigned by**, **assigned to**, **performed by**, **completed by**, **acknowledged by**, **reviewed by**, and **authorized by**.
- Protect patient/owner data by least privilege, audit trails, and session security.

## 9. Suggested minimum domain model — proposal, not final schema

| Entity | Fields / concerns |
|---|---|
| `Encounter` | encounter ID, patient ID, status, care stage, acuity, arrival/departure times, location, attending clinician, disposition |
| `PatientAssignment` | role, current staff or pool, start/end, who changed it, rationale/history |
| `ClinicalObservation` | type/value/unit, observation time, entered time, author, method, species/context, amendments |
| `ClinicalNote` | author, note type, exam/plan text, unsigned draft state, signature, amendment trail |
| `Order` | category/details, ordering provider, authorizer, instructions, status, timestamps, linked results |
| `Task` | action, clinical priority, scheduling, assignee, creator, completion, handoff history, linked encounter/order |
| `ReviewRequest` | requestor, recipient, reason, linked finding, status, acknowledgment/review/decision, timestamps |
| `MedicationRecord` | prescribed vs given; drug/dose/route/time, authorization, administrator and reconciliation status |
| `CareTimelineEvent` | event type, source record, occurred_at, entered_at, author, audit references |
| `ClientCommunication` | contacted party, timestamp, staff member, next planned update, separately approved client-safe text |
| `DischargePlan` | clinical readiness, authorizing vet, instructions/prescriptions, education confirmation, unresolved follow-up owner, pickup and departure |
| `AuditEvent` | actor, action, subject, prior/new value where allowed, occurred_at, source/session, reason |

Derived counters and status labels must use explicit query rules and not introduce new writable shadow states.

## 10. Interaction acceptance checklist

### Shared shell and styling

- [ ] Same header layout, typography, colors, radii, and spacing conventions as ER Overview.
- [ ] **My Patients** active; ER board shown as adjacent nav tab.
- [ ] Metric active state: **white background, thin teal outline, subtle shadow, ACTIVE tag**.
- [ ] Selected patient card: white background, thin teal outline/highlight; visually consistent with ER Overview.
- [ ] Critical / Urgent / Stable text badges beside patient names across queue and chart.

### Page structure

- [ ] Three metric cards; **no fourth draft card**.
- [ ] **No independent Needs your attention sidebar** at any viewport size.
- [ ] One queue (~30%) and one larger chart (~70%) on typical desktop.
- [ ] Narrow screens remain usable; no truncated chart action buttons or unreadably small vital text.

### Filters and queue

- [ ] My active patients card filters assigned patients.
- [ ] Needs my attention card filters by **distinct patients** with qualifying veterinarian actions.
- [ ] Review requests card filters by **distinct patients** with pending veterinarian reviews.
- [ ] Relevant click leads to **Tasks & reviews** in selected chart.
- [ ] Clear filter restores default list.
- [ ] Assigned / All active and search work predictably with metric cards.
- [ ] Queue shows the next vet-relevant documented action, additional-action count, and review flags.
- [ ] Unsigned draft displays on the patient card after draft save and disappears only after proper sign-off/discard.
- [ ] Selecting a new patient updates all chart sections and handles unsaved edits safely.

### Clinical functionality

- [ ] Latest vitals have units, measurement timestamp, author/source where appropriate and clear “not recorded” handling.
- [ ] No auto-filled normal exam findings, diagnoses, or vital thresholds.
- [ ] Document draft can be saved and resumed; production signing enforces authority and audit.
- [ ] Order draft does not falsely appear authorized.
- [ ] Technician review request is distinct from completion and authorization.
- [ ] Discharge readiness does not automatically equal patient departure.
- [ ] Outstanding follow-up remains assigned and visible after discharge.
- [ ] All changes show proper staff attribution and event/entry timestamps.

## 11. Proof-of-concept limitations / do not implement literally

- Fictional patient cases (Milo, Luna, Biscuit, etc.), sample vital values, timestamps, alert colors and summary counts are **demonstration content**, not clinical requirements.
- The POC uses in-memory browser state, simplified task status transitions and simulated sign-off. Production requires persistence, concurrency, authorization, auditable history, robust validation, and real error states.
- The active-patient metrics and queue ordering are concept demonstrations; production definitions must be written and tested.
- The POC may include obsolete hidden layout code from earlier iterations. **Do not revive the retired “Needs your attention” panel or earlier mint-filled selected metric card.** The latest agreed UX takes precedence over legacy or hidden markup.
- The screenshot/reference is for relative hierarchy and interaction semantics, not exact pixels.

## 12. Outstanding decisions requiring hospital / clinical validation

1. Which roles may create, authorize, administer, amend, and discontinue which order types in each jurisdiction?
2. Which statuses and urgency levels are clinically meaningful, and how should validated alert thresholds vary by species, age, and care context?
3. What events require clinician sign-off versus acknowledgment versus co-signature?
4. What constitutes a veterinarian attention item for each hospital; which requests require immediate escalation?
5. What are appropriate defaults for assignment pools, cross-coverage, shift handoff, and temporary attending changes?
6. When may a veterinarian act on an unassigned patient and which audit/authorization controls apply?
7. Which communication details are approved for front desk use and which remain clinician-only?
8. How should offline operation, competing edits, autosave recovery, and note amendments work?
9. Which tasks/results can remain open after clinical discharge and how is follow-up guaranteed?
10. What clinical workflow steps should be optional in the UI without compromising required documentation or legal compliance?

## 13. Developer implementation notes for Claude or another coding agent

1. **Inspect the current VetiFlow codebase first.** Reuse established shell, tokens, components, routing and record models instead of copying standalone HTML wholesale.
2. Treat **ER Overview and My Patients as siblings in one product** with a shared header and common component library, but distinct content and role permissions.
3. Implement the **single patient queue + expanded chart** and remove the redundant third sidebar.
4. Make the three metric cards functional, accessible filters. Maintain keyboard semantics, focus states, aria-pressed, and reasonable screen-reader labels.
5. Reuse the shared acuity badge design beside patient names. Do not use color alone.
6. Derive status/metrics from canonical encounter/task/review tables. Avoid hardcoded counts and unsynchronized mock state.
7. Build task, review, order and signing state machines explicitly; treat every permission and transition as enforceable server-side.
8. Handle stale data, incomplete notes, reassignment, and concurrent staff changes as normal ER conditions, not exceptional failures.
9. Use incremental delivery: shell/styles → queue/filters → read-only chart → drafts → task/review actions → orders/signatures → discharge and audit.
10. Have veterinarians, credentialed technicians, and relevant administrative staff validate the workflow before clinical deployment. This document is **product design guidance**, not veterinary medical or legal advice.

---

**Governing decision:** Optimize Veterinarian My Patients for **fast clinical prioritization and safe completion of care**, not for maximizing recorded task volume. Preserve clarity, accountability, and realistic interruption-tolerant charting.


---

## Enhanced veterinarian-workflow addendum — October 30, 2026

**Prototype reference:** `VetiFlow_Veterinarian_My_Patients_Enhanced_POC.html`

**Status legend:** **Agreed direction** = product decision; **Proposed interaction** = demonstrated prototype behavior, subject to iteration; **Production safety requirement** = implementation constraint requiring clinical, legal, and operational validation. The HTML is a **PROOF OF CONCEPT — NOT A PIXEL-PERFECT DESIGN SPECIFICATION**. Clinical data, identities, and timestamps are fictional. A browser demo's state transitions are **not** genuine authorization, clinical notification, audit-compliant documentation, or signature.

### A. Preserve the existing page shell — agreed direction

- Keep **Northside Veterinary Emergency** as the shared page title and the same breadcrumb, global header, search, shift indicator, and navigation treatment as ER Overview. **My Patients** is active in this standalone prototype; ER Board remains visible but does not navigate to an unrelated mockup.
- Keep only **Patient Queue** and a wide **selected patient clinical workspace**. **Do not reintroduce a separate Needs Your Attention sidebar**.
- Keep **Critical / Urgent / Stable** as textual badges adjacent to patient names, using the same placement and established design tokens as ER Overview.
- Keep three functional summary filters: **My active patients**, **Needs my attention**, **Review requests**. Active cards remain white with a thin teal outline and restrained shadow; never fill the entire card teal.
- The queue shows the most relevant documented next veterinarian action, additional-action counts, and unsigned-draft markers without implying a complete picture of undocumented bedside events.

### B. Order lifecycle and authorization — production safety requirement

**Problem:** Order drafts, authorized instructions, active work, completed diagnostics, and reviewed results cannot be treated as equivalent. Technician medication administration must be gated on valid authorized orders.

**Minimum canonical state model** (adapt to the team's established backend and hospital policy): `draft`, `pending_authorization`, `authorized`, `in_progress`, `completed`, `results_available`, `review_required`, `reviewed`, `held`, `discontinued`, `superseded` and explicit cancellation reason when applicable. Do not collapse interpretation/review into execution completion.

**Expected UI:** For each order display description, category, owner/authorizer, current state, last action time, and available authorized actions. A draft may be edited and submitted for signature; an authorized order may be held or discontinued; changes produce a new version or documented amendment and trigger downstream coordination. Diagnostic results needing clinician interpretation must remain visibly pending review. For medication orders, include structured drug details and checks (patient, drug, concentration, route, dose, frequency, indication, timing, allergies/interactions as applicable). This prototype intentionally demonstrates only generic order-state actions; these fields and prescription safeguards are **not implemented**.

**Backend:** Enforce role privileges and real signing/verification server-side. An HTML button or a technician's request cannot create medical authorization. Every change must preserve user identity, server event timestamps, versions, audit history, and notification or downstream status update when required.

### C. Urgent escalation versus routine review — production safety requirement

An **urgent clinical escalation** is not a routine task or review request. Display it prominently in Clinical Overview and Tasks & Reviews, including reporting staff, recipient, documented time, acknowledgment state, and response/disposition. Never infer that acknowledging a message resolves the clinical concern. Support `unacknowledged`, `acknowledged`, `follow_up_in_progress`, `transferred`, and `resolved_after_assessment` as distinct lifecycle concepts.

**Required clinical operations:** An urgent event must follow hospital-defined direct verbal/paging/contact protocols and escalation timers. The prototype does not send any real alerts. A production workflow must fail safely if a message cannot be delivered or acknowledged. Show who owns the response and avoid relying on a single busy attending veterinarian.

**Proposed demo interactions:** **Acknowledge receipt** and **Document response / handoff** are separate controls; routine review requests have **Acknowledge**, **Request info**, **Review**, and **Resolve** actions.

### D. Review request lifecycle — agreed direction

Review creation, receipt acknowledgment, clinical assessment, request for clarification, resolution, and authorization are distinct events. Suggested statuses: `requested`, `acknowledged`, `information_requested`, `in_review`, `reviewed`, `resolved`, `cancelled`.

- An acknowledgment means the request was received, **not** medically reviewed, signed, or approved.
- The patient queue and review counter continue to reflect nonresolved review requests, with appropriate distinction between pending and awaiting clarification.
- Changes require authorship, date/time, notes, reassignment records, and references to the related clinical observation/task/order.
- A clinician may request more information without discarding the original request.

### E. Attending veterinarian, temporary coverage, and handoff — agreed direction

Patient record should separately identify (1) assigned attending veterinarian, (2) current covering/on-call veterinarian when relevant, (3) technician or shared technician pool, and (4) recipient of a specific escalation or review. Changes to coverage must not silently rewrite who originally authorized or performed care.

**Handoff record:** `from_clinician`, `to_clinician`, `reason`, `outstanding_issues`, `handoff_created_at`, `acknowledged_at`, `effective_at`, `status`, and `audit_history`. For high-risk handoffs, unresolved items remain attributable until the recipient accepts ownership under hospital policy.

**Prototype:** Shows a covering veterinarian and permits recording a handoff note. Its recorded state is explicitly **awaiting recipient confirmation**. It is not a real acknowledgment workflow.

### F. Pending diagnostics and results review — production safety requirement

Within the Clinical Overview, display pending diagnostics with the test/study, current processing/result state, named follow-up clinician, and last update time. The clinician must be able to identify results **awaiting collection**, **in process**, **available but not interpreted**, **reviewed**, and **requiring post-discharge follow-up**. A result should not disappear because its specimen collection task was completed. Do not claim diagnostic interpretation without a documented clinician review.

### G. Delayed charting, autosave, and unsigned notes — agreed direction

Emergency staff may act first and chart later. Support autosaving **unsigned drafts**, interruption recovery, and returning to the same patient's in-progress note without blocking urgent care. Separate:

- `event_occurred_at`: when examination, measurement, or clinical decision actually occurred (user supplied/confirmed);
- `record_created_at`: when data was entered into the system;
- `record_updated_at`, `signed_at`, `signed_by`, and amendment/version history.

Show unsigned status on the patient card. Do not represent autosave as signing. Preserve delayed entries and identify them as such when required; no silent backdating or data overwrite. Draft recovery should be secure and reliable across sessions; local in-memory demo autosave is **not production persistence**.

### H. Discharge with unresolved follow-up — production safety requirement

Discharge workflow must distinguish medical authorization from owner instruction delivery, checkout/payment, and confirmed physical departure. If diagnostic results or concerns remain outstanding, a named clinical follow-up owner and a documented follow-up plan are required according to hospital policy. Pending clinical issues remain trackable **after** the encounter leaves the active ER census. Never automatically mark all tasks complete or all concerns resolved when discharge is authorized.

The enhanced prototype requires a named follow-up owner before demonstration authorization when tracked diagnostics remain pending. This is an illustrative guardrail, not a sufficient production discharge protocol.

### I. Cross-role synchronization and privacy — production safety requirement

Both veterinarian and technician pages must read/write the **same encounter entities**, with role-appropriate permissions and event propagation. Changes should appear in the other role's patient context without separate copies of order or task state. Front-desk communications remain limited to approved, client-safe information; internal escalation and draft notes do not automatically become owner-facing updates.

Suggested shared entities: `Patient`, `Encounter`, `CareTeamAssignment`, `CoverageHandoff`, `TriageAssessment`, `ClinicalObservation`, `ClinicalNote`, `Order`, `OrderVersion`, `DiagnosticResult`, `CareTask`, `VetReviewRequest`, `ClinicalEscalation`, `DischargePlan`, `FollowupResponsibility`, and `AuditEvent`. Prefer the product's existing structures; do not introduce redundant tables merely to mimic the demo.

### J. Acceptance scenarios for the enhanced design

1. **Urgent escalation:** Technician logs a serious concern; veterinarian sees it without using the separate sidebar. Acknowledgment records receipt; the concern remains open until a documented disposition. Immediate notification uses an independently validated hospital process.
2. **Order authorization:** Veterinarian creates a draft medication order. Technician cannot administer against that draft. Authorized version becomes available to permitted staff. Holding/discontinuing prevents further action according to validated policies.
3. **Review lifecycle:** Technician requests clinical review; veterinarian acknowledges, requests clarification if needed, reviews, and resolves. Each step is separately attributable, and counts update accurately.
4. **Coverage:** A covering veterinarian is designated and a handoff recorded. Original attending and original author remain intact. Recipient acceptance is explicit before ownership is transferred.
5. **Diagnostic follow-up:** An outstanding result remains visible until interpretation and follow-up responsibilities are documented, even when a related collection task is complete.
6. **Interrupted note:** Veterinarian starts exam documentation, changes patient, returns, and retrieves the unsigned draft with event and entry times distinguished. A draft cannot silently become a signed note.
7. **Discharge:** A patient with pending diagnostics cannot complete the proposed clinical-authorization workflow without a follow-up owner; physical departure and checkout are separate events.
8. **UI consistency:** Shared header, patient queue, colored acuity labels, three clickable white summary cards with restrained teal selected state, and a wide clinical workspace match the established ER Overview visual system.
9. **Role isolation:** A technician cannot sign a veterinarian-only order or approve medical discharge by manipulating the interface; permissions are tested on the server, not just hidden buttons.
10. **Truthful data:** If vitals or updates are old, missing, or recorded late, the UI shows the underlying timestamps and never claims undocumented care is completed.

### K. Deliberately out of scope for this page

- Rebuilding ER Overview or its shared Patient Overview.
- Replacing the technician workspace, creating a separate triage application, or introducing an additional attention sidebar.
- Staff competency scoring from task volume/speed.
- Production-ready prescribing, pharmacy verification, clinical signatures, clinical notification delivery, or legally sufficient audit trails. These require validated backend services, clinical review, and regulatory assessment.

**Developer handoff instruction:** Treat the Markdown requirements as the workflow contract, and the HTML as an illustrative UI/interaction reference. Preserve VetiFlow's established design system; do not copy sample patient data, invented clinical actions, or prototype-only shortcuts into production.
