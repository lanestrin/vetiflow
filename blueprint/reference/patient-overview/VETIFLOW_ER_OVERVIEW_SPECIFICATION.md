# VetiFlow — ER Overview Development Specification

**Document status:** Development handoff / product requirements  
**Scope:** ER Board and selected Patient Overview panel only  
**Reference prototype:** `VetiFlow_ER_Overview_Shared_Status_POC.html`  
**Visual status:** **PROOF OF CONCEPT — NOT A PIXEL-PERFECT DESIGN SPECIFICATION**  
**Date:** October 30, 2026

> **Important for Claude / the development team:** The referenced HTML is a functional exploration of information hierarchy, not a production-ready implementation or mandatory visual replica. Inspect the existing VetiFlow codebase and design system before implementation. Preserve working features and use the prototype to understand intended content, navigation, and workflows. **Do not copy arbitrary demo data, clinical thresholds, times, colors, or layouts as authoritative.**

## 1. Product intent

The ER Overview is a **shared hospital-wide awareness and coordination screen** for veterinarians, technicians, reception/client service staff, and shift supervisors. It must help a staff member quickly determine:

1. Who the patient is and why they are in the ER.
2. What is known about their current condition and the age of that information.
3. Where the patient is, what stage of care they are in, and who is responsible.
4. What the next **documented** care step or reassessment is.
5. What has been communicated to the pet parent and when an update is expected.

The ER Overview **does not replace** clinical judgment, the full patient chart, or the role-specific **My Patients** workspace. Veterinary and technician users are expected to spend substantial time in My Patients for their own tasks and documentation. The ER Overview displays a shared summary of recorded information, not a prediction of the patient's real-time state.

## 2. In scope vs. out of scope

### In scope

- ER Board with priority/acuity lanes and selectable active patient cards.
- Hospital overview metrics and existing filter/sort controls.
- Selected patient's compact Patient Overview.
- Read-only quick-access **Clinical**, **Medications**, and **Timeline** views/drawers.
- Current care stage, location, care-team assignment, recorded vitals, care priorities, and client communications.
- Clear source/status/freshness handling and role-based visibility.

### Out of scope for *this* prototype

- Designing the My Patients page or its veterinarian/technician workspaces.
- Full order entry, examination entry, nursing task completion, medication administration, and discharge charting.
- Final role-authentication, clinical permission enforcement, signatures, billing, and audit infrastructure.
- Production clinical alert rules/reference ranges.

Those features belong in the broader VetiFlow plan and must connect to the ER Overview through shared patient/encounter data when implemented.

## 3. Navigation and page header

- Keep the **ER Board | My Patients** navigation visible, along with its short supporting label if space permits.
- **ER Board** is selected on this prototype.
- **My Patients is present but inactive/non-navigating** until its dedicated prototype and page design are complete. Do **not** use an obsolete demo My Patients screen in place of that future design.
- Main page title: **Northside Veterinary Emergency**.
- Subtitle: **Live patient flow and care coordination**.
- Header breadcrumb may say **VetiFlow / ER Overview**. Avoid repeating “ER Command Center” as the large page title.
- Retain the existing top-level **New intake** access and summary statistics unless the core application requirements change.
- Preserve the existing **Filter** and **Priority/sort** actions. **Remove the redundant Critical / Urgent / Stable filter-pill strip**: the priority lanes and filter control already communicate these categories.
- Keep the patient board usable when no patient is selected; show an intentional empty state in the detail area.

## 4. ER Board behavior

The board presents patients in **Critical**, **Urgent**, and **Stable** acuity lanes (or the configured hospital triage categories). These are **acuity categories, not care workflow stages**. A patient can be Critical *and* In treatment, or Stable *and* Awaiting pickup.

Each patient card should show, when available:

- Patient name, species/breed and relevant identifiers.
- Triage acuity, current stage or concise stage indicator.
- Short presenting complaint.
- Current assignment and clinically relevant urgency indicators.
- A useful elapsed-time indication, with its meaning explicit (e.g., waiting, in treatment) rather than an unlabeled timer.

Selecting a card updates the Patient Overview without changing pages. Filters and sort functions should not silently alter the selected patient's record. Avoid auto-inferring medical stability from a change in workflow stage.

## 5. Patient Overview — recommended information hierarchy

This panel is the **shared status summary**. Keep type readable at the actual panel width; resist shrinking text to show more information. Prioritize:

| Order | Section | Required behavior |
|---|---|---|
| 1 | Patient identity and acuity | Name, species/breed, age/weight when documented, case ID, and acuity; show unknown data honestly. |
| 2 | Presenting complaint | Short, readable reason for visit; allow wrapping. |
| 3 | Current care stage + location | Distinct labels for stage and latest documented location; state unassigned/unknown when necessary. |
| 4 | Immediate documented priority | Highest relevant documented next action, responsible person when known, state/due time if available; do not imply that the UI determines treatment. |
| 5 | Latest recorded vitals | HR, RR, temperature, SpO₂ when measured; include units and measurement time. No generic abnormal coloring without validated, context-aware logic. |
| 6 | Safety and care team | Allergy status, attending veterinarian, primary technician when assigned. Preserve “unknown” vs “no known allergies.” |
| 7 | Client communication | Last approved update (who/when), next planned update, and short approved client-facing note when available. |
| 8 | Quick access | **Clinical**, **Medications**, **Timeline** buttons opening deeper information without permanently extending the overview. |

**Clarification:** The layout and precise order can be refined during UI testing. All eight responsibilities should be supported. Avoid displaying an entire task list, full chronology, medication ledger, or exam form in this compact panel.

### 5.1 Patient identity and complaint

- Keep triage acuity visually distinct and appropriately labeled.
- Presenting complaint should be the most current documented summary, not invented text.
- Weight and age may be missing; do not fabricate them.
- Consider showing encounter identifier and check-in time in the header, but do not repeat them in multiple places.

### 5.2 Care stage and location

Possible illustrative stages: Awaiting triage, Awaiting veterinarian, Diagnostics, In treatment, Monitoring, Discharge preparation, Awaiting pickup, Discharged. Actual stage transitions must follow documented hospital workflows.

- **Care stage != triage acuity.** Store separately.
- Location should reflect the last confirmed assignment, with attribution/time if available.
- Do not silently mark treatment complete merely because another event was documented.

### 5.3 Immediate next step / reassessment

- Display the **next documented action** relevant to coordination, not a diagnosis or automatically generated treatment recommendation.
- Prefer the most clinically significant outstanding item, considering explicit priority, status, due time, and whether a clinical review is required.
- Show the responsible assignee when known. Creator/assigner can be accessed in task details, rather than flooding the summary.
- Clearly distinguish **overdue**, **due soon**, **pending review**, **not scheduled**, and **no documented action**.
- An overdue administrative task is not automatically more critical than an urgent clinical review. Prioritization rules must be validated with ER staff.
- A completed nursing task does not prove the patient is clinically resolved.
- When no actions are recorded, use neutral language such as “No next action documented,” not “All clear.”

### 5.4 Vitals

- Support documented HR, RR, temperature, SpO₂, and appropriate units; weight belongs in demographics unless hospital policy requires a separate measurement tile.
- Timestamp measurements using **actual measured time**, and keep record-entry time separately where relevant.
- Mark absent readings as **Not recorded**, not zero or normal.
- Clinical assessment fields (mucous membranes, CRT, mentation, hydration, pulse quality) stay in **Clinical**, and only documented items need appear there.
- Do not put a generic 0–10 pain slider in the ER Overview. Any approved species-specific pain assessment belongs in a suitable clinical workflow.
- Abnormal-value highlighting is a **future validated implementation requirement**, not an instruction to reuse demo colors or ranges.

### 5.5 Allergies and care-team responsibilities

- Allergy state must distinguish **documented allergy**, **no known allergies (verified)**, **unknown/not verified**, and **not recorded**.
- The overview should show **attending veterinarian** and **primary technician** when assigned; some clinics use a shared pool, so primary technician may be blank or unassigned.
- The broader patient record should capture other contributors automatically from their care activities; do not require everyone to belong to a fixed veterinarian-team pairing.
- Scope visibility by actual role/permission, not only by a dropdown role label.

### 5.6 Client communication for reception

- Show **last approved update timestamp + communicator**, **next planned update**, and optionally a short **approved client-facing note**.
- Explicitly distinguish no communication recorded from “family has not been contacted.”
- **Never automatically expose internal medical notes, preliminary diagnoses, or undocumented clinical assumptions to reception or pet parents.**
- Only authorized users should approve client-safe wording. If no approved note exists, show “No approved client-facing update recorded.”
- Reception needs a clear route to the attending clinician or appropriate team contact, not unrestricted medical editing.

## 6. Clinical / Medications / Timeline quick-access views

Keep three distinct buttons **inside the Patient Overview**. Their contents should open in a single dedicated slide-out detail panel (or an equivalent focused surface), not all expand inline simultaneously.

| Button | Information to show | Boundaries |
|---|---|---|
| **Clinical** | Last recorded vitals and timestamps, structured MM/CRT/mentation and other assessments when entered, clinical notes permitted for role | No full examination form in the ER Overview; respect read access. |
| **Medications** | Reconciled current/home medications, recent administrations, relevant histories; drug/dose/route/frequency/last given when documented | Distinguish orders from administrations and verified lists from unknown history. Do not fabricate medication records. |
| **Timeline** | Chronological encounter milestones, documented assessments, care events, handoffs, and historical changes as allowed | Show who entered/performed each event when known; do not conflate documentation time with event time. |

- Only one drawer is open at a time; it closes cleanly with close control and Escape.
- Switching selected patients must refresh the opened view or close it safely; no stale data from the previous patient.
- The drawer is designed for **review and context**. Full editing occurs in the future role-specific My Patients workflow.

## 7. Data sourcing and update behavior

The ER Overview is **derived from the same shared encounter record** that staff update through My Patients and other authorized workflows.

| ER Overview value | Source (proposed) |
|---|---|
| Identity / parent / reason | Patient + encounter/intake records |
| Acuity | Documented triage classification |
| Stage | Encounter workflow/status transitions |
| Location | Bed/room/care-area assignment |
| Vitals / assessment | Latest valid measured observations with timestamps |
| Allergies | Structured allergy/reconciliation record |
| Assigned staff | Current patient-level responsibility assignments |
| Next priority / reassessment | Open task/monitoring/request records with explicitly assigned priorities and due times |
| Client communication | Authorized communication log and next-update plan |
| Clinical / Medications / Timeline | Permission-filtered encounter data |

**Key rule:** If clinicians cannot document immediately during a busy emergency, the screen must show the **last documented state** and the time/source of that state; it must not pretend to be live clinical truth. Record **event time** and **entry time** separately when the workflow permits retrospective charting.

Suggested missing/uncertain states: `Not recorded`, `Unknown / not verified`, `Not assigned`, `Not scheduled`, `Awaiting confirmation`, and `Last recorded at [time]`. These should be treated distinctly in storage.

## 8. Role-based visibility

- **Veterinarian:** Sees the coordinated status and eligible clinical quick-access details. Uses **My Patients** for clinical charting, decisions, review, orders, and discharge authorization.
- **Technician:** Sees patient status and permitted clinical/medication/task context. Uses **My Patients** for observations, monitoring, care performed, and review requests.
- **Reception/client services:** Sees operational status and approved client communication; more sensitive clinical content is permission-filtered.
- **Shift supervisor/charge staff:** May see broader hospital assignments and active care statuses according to permissions.

Exact per-field access and clinical authority must be validated against hospital policy and applicable laws. A client-facing note is not a substitute for approved communication workflows.

## 9. Task accountability — shared data, not full task UI here

Task creation, assignment, completion, and review live chiefly in **My Patients**, but urgent **documented** responsibilities may be summarized on the ER Overview.

Preserve in the underlying model:

- Created by; assigned by; assigned to.
- Created, assigned, due, completed, and reviewed timestamps.
- Status, priority, reason/context, reassignment history, and approvals where required.
- Performed by versus authorized by for medication and other clinical actions.
- A technician can request veterinarian review/sign-off when permitted; a request is **not** itself an authorization.

Task history is for **accountability, handoffs, quality improvement, and training** — **not automated employee competency scoring or productivity rankings**.

## 10. Discharge and other patient outcomes

The ER Overview shows the stage, such as **Discharge preparation**, **Ready for discharge**, or **Awaiting pickup**, while discharge documentation is handled in **My Patients** and administrative checkout tools.

- Medically cleared does **not** mean physically departed.
- Remove from the active ER census only after departure is documented and encounter status is updated appropriately.
- Preserve full history and unresolved follow-up ownership.
- Hospital admission, transfer, and death/euthanasia need distinct outcome workflows, not ordinary home-discharge labels.

## 11. Visual design guidance

**PROOF OF CONCEPT — NOT AN EXACT UI SPECIFICATION.** The HTML demonstrates structure and interactions only.

- Preserve VetiFlow's current teal, navy, neutral surfaces, and overall visual language where appropriate.
- Use readable typography at the **real available right-panel width**. Do not solve crowding by shrinking labels into illegibility.
- Prefer a short, legible hierarchy over a large number of cards and colored badges.
- Use color for verified clinical significance or actual workflow urgency, not decoration.
- Do not repeat fields (location, status, staff, or timestamps) in multiple adjacent sections.
- Optimize for desktop ER coordination; establish a mobile/tablet behavior without redundant filter controls.
- Use explicit empty states and accessible button labels; support keyboard and screen reader navigation.

## 12. Implementation acceptance criteria

- [ ] Page heading reads **Northside Veterinary Emergency**; subtitle describes live coordination.
- [ ] **ER Board | My Patients** switch remains visible; My Patients stays intentionally non-navigable in this proof-of-concept.
- [ ] No redundant Critical/Urgent/Stable filter-pill strip is shown; existing filters and triage lanes remain.
- [ ] Patient selection updates the overview for the correct encounter without stale cross-patient data.
- [ ] Acuity and care stage are stored/displayed as different concepts.
- [ ] Overview includes identity, complaint, care stage, location, next documented action/reassessment, and latest available vital values with meaningful timestamps.
- [ ] Unknown and unverified clinical states are not presented as normal or confirmed.
- [ ] Care-team responsibility and allergy status are visible with clear missing states.
- [ ] Last client communication, next planned update, and approved client-facing note are shown only when available and permitted.
- [ ] Clinical, Medications, Timeline buttons open focused, role-filtered detail views without cluttering the main panel.
- [ ] No generic pain-score slider or permanent full care timeline appears in the compact overview.
- [ ] Latest documented data is displayed without inventing real-time clinical changes.
- [ ] No unsafe automatic clinical conclusions or fabricated recommendations appear.
- [ ] Screen works at realistic dashboard widths, and keyboard interaction is usable.

## 13. Open items requiring clinical/product validation

1. Which care-stage vocabulary and transition events apply across small ER clinics and large 24-hour hospitals?
2. How should the highest-priority *documented* action be selected when several tasks are simultaneously due?
3. What are the precise clinical and administrative data permissions by role and credential?
4. Who can approve a client-facing communication note, and what is the approved escalation process?
5. How should information freshness, stale vitals, and overdue reassessments be configured per hospital?
6. Which patient outcome events should remove a case from the active board?
7. How do smaller clinics without primary-technician assignments represent shared care reliably?

## 14. Developer instruction / handoff prompt

> Implement the VetiFlow ER Overview according to this document, using `VetiFlow_ER_Overview_Shared_Status_POC.html` as a **proof-of-concept behavioral reference only**. Do not reproduce the HTML pixel-for-pixel or reuse its fictional medical findings as production data. Keep the ER Board and My Patients navigation visible, with My Patients inactive in this prototype. Prioritize shared hospital awareness, documented data freshness, clinical safety, and approved client communication. Keep documentation workflows in the separately designed My Patients area. Inspect the existing design system and code before making structural changes; implement incrementally and verify the acceptance criteria above.

---

**Document scope boundary:** This file intentionally covers only the ER Overview. The full VetiFlow development handoff separately addresses My Patients, clinician/technician workflows, task assignment, medication management, and discharge.
