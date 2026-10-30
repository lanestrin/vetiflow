# VetiFlow — Technician My Patients

**Development handoff | Version 1.1 | October 30, 2026**  
**PROOF OF CONCEPT — NOT A PIXEL-PERFECT DESIGN SPECIFICATION**

## 1. Scope and intent

Build the technician-facing **My Patients** workspace using the same shared design system, encounter record, patient identities, acuity indicators, and navigation shell as the veterinarian's My Patients and ER Overview. This is a clinical documentation and care-coordination workspace for technicians; it is **not** a duplicate of the veterinarian's diagnosis, prescription, and authorization workspace.

Technicians need to move quickly among patient charts; see assigned care and monitoring; enter measured vitals and nursing findings; document authorized medication administration; hand off responsibility; escalate concerns; request veterinarian review; and prepare veterinarian-approved discharge materials. Emergency situations may prevent immediate documentation. Record the real-world event time separately from entry time and preserve an audit trail.

**Do not treat the prototype's invented clinical values, sample orders, timestamps, names, or example states as production medical logic.** Hospital policy, professional oversight, and applicable law determine who may perform each clinical action.

## 2. Shared visual and layout requirements — AGREED DIRECTION

- Shared page header identical in structure to ER Overview and Veterinarian My Patients: **Northside Veterinary Emergency**, patient search, notifications, active shift, intake entry, user avatar/name.
- The top **ER board / My Patients** navigation remains in the same position; **My Patients** is selected here. The ER board link is deliberately non-navigating in this standalone POC.
- Preserve neutral white summary metric cards, narrow teal active outline, subtle active shadow, and restrained typography. Avoid filled-teal selected metric cards.
- Keep a **two-column main workspace**: one Patient Queue at left and a wider selected patient chart at right. Do not add a redundant “Needs Your Attention” sidebar.
- Place explicit **Critical / Urgent / Stable** badges beside patient names using the same acuity styles as the ER Overview, separate from workload and task state.
- Selected patient card uses restrained teal border and subtle highlight consistent with the ER Overview.
- On smaller screens, preserve access to both queue and chart without illegible text or hidden safety information.

## 3. Primary structure — AGREED DIRECTION

### Top-level clickable summary filters

1. **My active patients** — show the patients assigned to the technician or their configured shared pool.
2. **Needs my attention** — show patients with outstanding technician-assigned actions that need action or follow-up.
3. **Veterinarian review requests** — show patients with open veterinarian review requests.

The cards are filters, not performance metrics. Their counts should update from the patient/task data and should never be used to score staff competence, speed, or output.

### Patient Queue

Every patient card should show: name and acuity side by side; species; presenting complaint; care stage and location; the next recorded technician care item, if any; and separate indicators for outstanding review requests or saved draft documentation. Queue sorting should favor important and time-sensitive work without treating every overdue routine task as clinically critical. Provide clear assigned versus all-active-patients views subject to permissions. Filtering should not lose the selected chart or work in progress unexpectedly.

### Selected chart tabs

- **Care overview** — presenting complaint, stage, location, last recorded vitals and their measurement time, allergy status, assigned care team, pending care tasks, pending requests, and latest approved owner communication status.
- **Vitals & observations** — measured numeric readings; optional mucous membranes, CRT, mentation and other configured fields; nursing observations and draft notes.
- **Care tasks** — permitted assigned tasks, due status, performed-by/time, documentation, and an option to request clinical review where needed.
- **Medications** — verified authorized orders and medication administration record (MAR), including held/refused/omitted states.
- **Vet review requests** — explicit questions or concerns sent to a veterinarian, showing sent/pending/acknowledged/reviewed states as separate events.
- **Handoff & escalation** — communications or responsibility handoffs, recipient, urgency, event time, entry time, and whether receipt is actually confirmed.
- **Timeline** — shared longitudinal record of performed care, chart updates, task changes, requests, handoffs, and authorization events.
- **Discharge prep** — approved take-home instructions, preparation and owner education documentation; **not** authority to clinically discharge the patient.

## 4. Medication safeguards — REQUIRED FOR PRODUCTION

The prototype demonstrates a guarded medication-entry interaction. A technician **cannot freely type a medication and have it treated as an authorized administration**.

- Medication documentation must reference an actual **verified, active authorized order** for the selected patient, with order identity and authorizing clinician visible.
- If no suitable order exists, **block the administration-entry action** and explain why.
- Pre-populate the medication, prescribed dose, units, route, and schedule from the authorized order; do not allow these details to be silently altered in the administration form. Any discrepancy needs a clarification workflow.
- Require appropriate patient/medication/dose/route/time checks; verify permissions and staff credentials and follow applicable local law and hospital policy. Add medication-specific double checks where policy requires.
- Support administered, held, refused, not given, partial administration when applicable, reaction/incident documentation, and relevant reason fields.
- Record performed by, actual performed time, entered by, entry time, linked order ID, and amendments; protect signed records and produce an immutable audit trail.
- Do not interpret **recorded** as proof that the software administered a drug. The browser demo uses fictional authorized orders solely to show the UI contract.

## 5. Care completion and clinical concerns

- Distinguish **task performed/documented** from **clinical concern resolved**.
- A task can be documented complete while newly abnormal observations create a separate veterinarian review request.
- Created by, assigned by, assigned to, performed by, completed by, reviewed by, authorization/signature and all timestamps must remain distinct.
- Authorized task types must be configurable; technician task creation must not become a path to prescribing or authorizing veterinarian-only treatment.
- Reassignment and task history should remain visible for safety, continuity, and training, **not staff productivity scoring**.

## 6. Handoffs, escalation, and veterinarian review

- **Vet review request:** Non-order communication asking for assessment, sign-off, clarification, or attention. Capture patient, sender, intended clinician, question/concern, priority, time, and status.
- **Handoff:** Capture from/to (staff or team), patient, what has been done, unresolved issues, next checks, responsibility transition, and timestamps.
- **Escalation:** A clinically important concern requires a clear, immediate escalation route. An in-app note by itself does not guarantee a recipient has seen it. Production design must specify direct-contact rules, timeout/escalation paths, and acknowledgment status.
- Do not let the initiating technician mark the receiving veterinarian as having acknowledged or authorized an action. **Sent, received, acknowledged, reviewed, and resolved are separate states.**
- The standalone prototype logs handoffs in memory; it does **not** send a notification or safely complete emergency escalation.

## 7. Interrupted, delayed, and incomplete charting

- Data entry should be quick and interruption-tolerant, with draft saving and a visible Unsigned / Draft indicator where appropriate.
- Distinguish the **measurement / performed / observed time** from the **documentation / system entry time**. Never backdate the system entry timestamp.
- Show the freshness of the most recent recorded observations; old chart data should not be presented as current measured condition.
- Preserve who entered or amended information, previous values, signature or review requirements, and reason for correction as dictated by policy.
- Omitted data are not equivalent to normal findings. “Not assessed” is different from a blank field. Never autopopulate normal findings.
- Saving a draft, performing a task, or entering a note must not silently change triage acuity, medical readiness, or discharge authorization.

## 8. Triage boundary (NOT a new full-page workflow)

The technician can see current patient acuity consistently. Qualified staff may initiate or update triage if separately authorized by hospital settings. Triage assessment itself is a shared workflow accessible beyond My Patients to handle unassigned arrivals. Do not add a full triage subsystem to the Technician My Patients prototype at this stage.

## 9. Discharge boundary

Technicians may prepare approved materials, review veterinarian-approved instructions with the owner, document education and questions, and coordinate handoff/checkout. The veterinarian retains medical discharge authorization. **Ready for discharge**, **awaiting pickup**, and **physically departed** must not be collapsed into one state. Never close outstanding important follow-ups automatically when a patient is discharged.

## 10. Suggested core objects (implementation proposal)

`Encounter`, `Patient`, `StaffUser`, `CareAssignment`, `TriageAssessment`, `ClinicalObservation`, `VitalSet`, `NursingNote`, `CareTask`, `TaskEvent`, `VeterinarianReviewRequest`, `Order`, `MedicationAdministration`, `Handoff`, `Escalation`, `ClientCommunication`, `DischargeChecklist`, `DischargeAuthorization`, and `AuditEvent`.

Use immutable IDs and traceable relationships, server-controlled created/updated timestamps, explicit event-time fields, status histories, and permission checks on the server, not just hidden UI controls. Keep a single longitudinal patient record shared with the veterinarian's workspace and ER Overview.

## 11. Prototype-specific interactive behavior

- Patient Queue selection switches the displayed chart while preserving shared navigation/styling.
- Summary metric cards filter queue entries; Review Requests opens the applicable chart section.
- Vitals form records only what the user enters, logs a documented event and separately tracks the stated measurement time and entry time (for demo only).
- Care task completion records the action; an optional veterinarian review request may follow.
- Review requests are recorded as pending, **not** automatically acknowledged.
- **Handoff & escalation** tab includes an interactive logging form, event time, recipient, subject, and note, marked **receipt not confirmed**.
- **Medications** tab blocks a new entry without a demonstration authorized order. With a sample verified order it constrains drug/dose/route to that order and captures an outcome. No clinical authorization is generated.
- Discharge prep is explicitly preparatory and does not sign or complete a medical discharge.

## 12. Acceptance criteria

- [ ] Header and active navigation match the Veterinarian My Patients and ER Overview shell.
- [ ] Three metric cards filter the Patient Queue; no separate Needs Your Attention sidebar exists.
- [ ] Patient acuity badge appears beside name; action/review status is separate.
- [ ] Technician cannot edit veterinarian-only orders, diagnoses, prescriptions, or discharge authorization.
- [ ] Medication-entry UI requires a matching verified authorized order; absence disables entry.
- [ ] MAR entry records order reference, staff identity, administered/held/etc. outcome, performed and entry times.
- [ ] Timestamps separate occurrence from recording; delayed documentation is visible, not silently normalized.
- [ ] Nursing observations can be recorded without inventing a diagnosis or auto-populating normal fields.
- [ ] Task completion does not automatically close an escalated clinical concern.
- [ ] Vet review requests and handoffs retain author, intended recipient, status, timestamps, and audit history.
- [ ] Sending a request does not imply acknowledgment, review, or clinician authorization.
- [ ] Urgent escalation has a specified direct-contact and follow-up policy in production.
- [ ] Shared patient data remains consistent across ER Overview, Veterinarian My Patients, and Technician My Patients.
- [ ] Discharge preparations cannot medically authorize or physically discharge a patient.
- [ ] Role permissions, clinical criteria and local regulatory constraints are validated with hospital clinical leadership before deployment.

## 13. Instructions for Claude / engineering

1. Inspect the current VetiFlow codebase before making changes.
2. Treat this file as the behavior-and-safety contract and the accompanying HTML as a **visual interaction proof of concept**, not production-ready code or pixel-perfect layout instruction.
3. Reuse existing application design tokens, components, responsive patterns, identity/authentication, audit infrastructure, and shared records.
4. Implement permissions and authorization on the backend. Do not treat browser-disabled buttons as an authorization boundary.
5. Keep encounter data consistent between the technician and veterinarian experiences. Avoid duplicate status fields maintained by each page.
6. Separate agreed workflow behavior from illustrative fictional records and assumptions needing clinician validation.
7. Conduct usability testing with veterinarians, technicians (including overnight/ER staff), and clinical leadership before production use.

**Associated prototype:** `VetiFlow_Technician_My_Patients_Enhanced_POC.html`.
