# VetiFlow — ER workflow and interface rules

Updated: November 2, 2026

This document records the product decisions made while developing the ER prototype and consolidating the veterinarian and technician proof-of-concept files. It distinguishes agreed behavior from the current demo's limitations. It is a product specification, not a clinical protocol or a statement of legal scope of practice.

## Decisions for the VetiFlow app (2026-11-02)

The prototype guides visual hierarchy and the shared patient record. Where it conflicts with these decisions, the decisions take precedence. They are recorded in `blueprint/build-plan.md` (Decisions) and reflected in the sections below.

1. **Board layout:** a table on desktop and compact patient cards on phones. Acuity stays clearly visible and filterable. This supersedes the app's earlier acuity-lane board.
2. **Stage and location:** the patient header shows the current values as buttons that open the app's small edit modals, rather than inline dropdowns.
3. **Demo role switch:** an app-wide Veterinarian / Technician switch labelled "Demo role — simulated access". It changes displayed controls and My patients filters, preserves the selected patient and shared demo data, and is independent of sign-in. Real authorization and server-enforced permissions are separate work.
4. **Navigation:** the app keeps Overview, ER board, Patients, Team, Reports and Settings. Phones use a bottom bar with overflow for destinations that do not fit comfortably. The prototype's reduced navigation does not apply to the app.
5. **Presenting complaint:** read-only for now; there is no Edit action.

## 1. Product structure

- Use one shared patient record, rather than separate veterinarian and technician records.
- Keep role-focused **My patients** views to answer “Who needs my attention next?”
- Use the shared record to answer “What is happening with this patient, who is responsible, and what needs doing next?”
- Both roles see relevant patient information. Their available actions differ.
- Do not duplicate a patient, task, order or review request when switching roles.
- A change made in one role must appear when the other role views the same patient in the same demo session.

## 2. Assignment and staffing model

### Technician-first default

1. During intake or triage, assign a **primary technician** when possible.
2. Assign the **attending veterinarian** next, or immediately when required.
3. Technician-first is the default sequence, not a mandatory dependency.
4. Intake can be saved with either or both assignments missing.
5. Assigning a technician must never block veterinarian assignment or an emergency response.
6. A veterinarian may be assigned before a technician when circumstances require it.
7. Show missing assignments explicitly as **Unassigned**. Do not infer assignment from the logged-in role, a room change, or a workflow stage.
8. Retain existing assignments when switching roles.

### Shared staffing

- Assign technicians to patients, not permanently to doctors.
- A technician can care for patients assigned to different veterinarians.
- A veterinarian can have patients supported by different technicians.
- A primary technician represents responsibility for coordinating that patient's nursing care; it does not imply exclusive staffing.
- A shared technician pool can represent shared coverage. It must be displayed explicitly rather than looking like a named person.
- Demo identities: **J. Lee is a veterinarian**; **M. Bell is a technician**. M. Bell does not have a separate group of technicians.
- Temporary veterinarian coverage is separate from the attending assignment. Recording a handoff is not the same as the recipient accepting responsibility.

### Consistent labels

- Board assignment labels must mean the same thing in both role views.
- Use **Care team**, with **Tech** and **Vet** shown separately and technician first. On small screens these names can stack in one cell.
- Do not show only a veterinarian in one role and only a technician in the other under the same ambiguous “Team” heading.
- Switching the demo role never changes what a board column means.
- “Critical without vet” counts missing attending-veterinarian assignments, not missing technicians.
- **Unassigned** on the board means at least one of the technician or veterinarian assignments is missing. Explicit filters distinguish **No technician assigned** and **No veterinarian assigned**.

## 3. Board and navigation

- Show the board as a table on desktop (Patient, Acuity, Care stage, Care team) and as compact patient cards on phones.
- Keep the board easy to scan: patient identity, acuity, care stage and care assignments.
- Keep long clinical narratives out of every board row.
- Use a compact summary strip instead of oversized metric cards.
- Distinguish Critical, Urgent and Stable using text as well as color.
- Keep **All patients** and **My patients**, search, priority sorting and filters.
- Do not use the **Team** destination merely to filter unassigned patients. Team assignments belong in the record, with assignment filters on the board.
- The app keeps its **Team** destination for its distinct purpose: who is on the floor and their workload. The app's navigation (Overview, ER board, Patients, Team, Reports, Settings) is not reduced to the prototype's.
- Vet My patients includes attending assignments and accepted coverage for that veterinarian.
- Technician My patients includes the technician's primary assignments and shared-pool patients.
- Personal attention indicators should identify outstanding work and open review requests across patients.
- Completed work must not silently resolve a related clinical concern.

## 4. Patient overview and record navigation

Use four main tabs:

1. **Overview**
2. **Clinical**
3. **Orders & Medications**
4. **Timeline**

- Open Overview when a patient is selected.
- Keep patient identity, acuity, location, care stage and allergy status visible across tabs.
- Show the current care stage and location in the patient header as buttons that open small edit modals, not inline dropdowns.
- Use tabs near the header, not large record-shortcut buttons at the bottom.
- Keep quick updates near the information they change.
- Display a clear save state and the updating person's identity and time.
- Use readable text, restrained alert colors, clear selection states and fewer nested containers.

Overview priorities:

1. Latest measured vitals and their measurement time, with a quick recording action.
2. Next care action, responsible person and due time.
3. Additional care tasks without crowding the initial snapshot.
4. Primary technician, attending veterinarian, coverage and allergy status.
5. Short presenting complaint, read-only for now (no edit action).
6. Visible indication when veterinarian review is pending.

## 5. Demo role switch

- Provide an app-wide **Veterinarian / Technician** switch labelled **Demo role — simulated access**, for quick development and demonstrations.
- Replace the old patient-level “Updating as” selector.
- Preserve the selected patient and the shared demo data when switching roles so controls can be compared directly.
- Change the displayed controls and the My patients filters; do not change the meaning of board columns.
- Keep it independent of sign-in: the signed-in account is unchanged, and account linking or account-to-role mapping is not required yet.
- Demo controls and JavaScript guards are not secure authentication or server authorization. Real, server-enforced permissions are separate work.

## 6. Recommended role permissions

These are product defaults for review. Production permissions must reflect local requirements, credentials, supervision, hospital protocols and approved delegation.

| Area | Veterinarian | Technician |
| --- | --- | --- |
| Shared patient information | View | View |
| Vitals and observations | Record and review | Record measured findings and observations |
| Complaint / patient history | Record; keep medical assessment separate | Record reported history and observed signs |
| Diagnosis, assessment and medical treatment plan | Create, revise and sign | Read signed documentation; request review or changes |
| Nursing documentation | View and contribute as appropriate | Add nursing notes and care events |
| Medical orders | Draft, authorize, hold, revise and discontinue | View; request clarification or change |
| Medication administration | Record against an authorized order | Record authorized administration or a reason it was held/not given |
| Care tasks | Create nursing tasks; authorize medical actions | Create nursing/coordination tasks; accept and document authorized care |
| Review requests | Acknowledge, ask for information, review and resolve | Submit concerns and reply to clarification requests |
| Location and routine care stage | Update | Update |
| Attending assignment / vet coverage | Manage | View; request coordination changes |
| Primary technician assignment | Assign | Assign / accept technician responsibility |
| Allergies and suspected reactions | Review and clarify | Record reported allergies or suspected reactions promptly |
| Triage / acuity | Assess, review and confirm | Initial triage and escalation under approved protocol |
| Medical discharge approval | Approve after assessment | View approval; perform preparation within approved instructions |
| Timeline / signed records | Add attributed events or amendments | Add attributed nursing/care events; do not overwrite another person's signed entry |

Do not make a technician wait for approval merely to document deterioration or report an allergy. Escalation and observation entry are distinct from independently changing medical treatment.

The present demo's acuity edit is available to both roles. A production escalation/downgrade policy and required review must be configured; the demo does not implement a complete triage protocol.

## 7. Clinical documentation

- Separate veterinarian assessment and medical decision-making from technician observations.
- Preserve unsigned drafts when navigating or switching roles.
- Distinguish **Save draft** from **Sign off**.
- Signed entries should be retained as snapshots; later entries should not silently rewrite prior signed documentation.
- Separate actual assessment/event time from documentation/signature time.
- Nursing notes identify who recorded them and when the care event occurred.
- Clinical sign-off in this prototype is illustrative and not a legally effective signature.

## 8. Care tasks

- Support multiple concrete actions with type, responsible person, due time and status.
- Distinguish nursing/coordination tasks from medical actions requiring authorization.
- Creating or assigning a task does not itself authorize treatment.
- Editing an authorized medical task must require renewed authorization of the changed action.
- Retain superseded tasks as history; do not label them as performed care.
- A technician can accept eligible care and document actual performance.
- Record performed-at time, author and relevant findings.
- Allow a review request to be raised while recording performed care.
- Task completion does not mean the patient is stable, a concern is resolved, or medication has been administered.
- Due/overdue prioritization is a product requirement. The current demo displays due times and personal attention queues but does not provide a complete overdue alerting or scheduling service.

## 9. Review requests and escalation

- Technician and veterinarian views must reference the same request.
- Distinguish **Requested**, **Acknowledged**, **Information requested**, **Reviewed** and **Resolved**.
- Recording or sending a request does not imply receipt or acknowledgment.
- A technician can reply to a request for clarification; that reply returns the item for vet attention.
- Resolution follows review and requires documentation, rather than an automatic checkbox effect.
- Preserve responses and author attribution.
- Handoffs record sender, recipient, subject, event time, entry time, current status and response.
- The sender must not self-confirm recipient acknowledgment.
- Logging a concern in the demo does not send a notification. Direct emergency communication remains separate.

## 10. Orders and medication administration

- Orders and administration records are separate objects in the shared record.
- Lifecycle: **Draft → Authorized → Held / revised / Discontinued**, as applicable.
- A revised order creates a new draft and preserves the prior version as superseded.
- Reauthorization is required before executing the changed order.
- Draft, held, superseded and discontinued orders are not eligible for administration entry.
- Medication orders capture the medication name, dose, route and frequency; the demo does not suggest clinical values.
- Administration references an eligible order and preserves the order details used at the time.
- Record actual event time separately from entry time and identify the person documenting care.
- Support given, held and not-given outcomes, with a reason for held/not given.
- Recording administration does not change the medical prescription.
- Task completion never substitutes for an administration record.

## 11. Diagnostics and follow-up

- Track the diagnostic, its status and a responsible follow-up clinician.
- Separate collection, result availability and veterinarian review.
- Technicians can record collection or availability; interpretation/review is a vet action.
- Pending or available results are not automatically considered reviewed.
- Outstanding results require explicit follow-up responsibility during discharge planning.

## 12. Coverage and discharge

- Preserve the attending veterinarian while tracking temporary coverage separately.
- A recorded coverage request remains pending until accepted by the intended recipient.
- A handoff should document outstanding decisions and responsibilities.
- Medical discharge approval is separate from technician preparation, client education, administrative checkout and physical departure.
- Technician preparation can include approved instruction review, approved take-home material preparation and documentation of owner questions/understanding.
- Preparation does not imply medical approval or release of the patient.
- A vet's discharge review includes the assessment, instructions, outstanding results and follow-up owner.
- Clinical approval alone must not mark the patient as physically departed.

## 13. Timing, audit and corrections

- Distinguish measurement/performed/event time from entry time.
- Do not prefill normal findings or replace missing values with assumed normal results.
- Display missing measurements and unknown allergy status honestly.
- Preserve who changed data, when they changed it, and the relevant patient/record context.
- Preserve signed snapshots, superseded order information and recorded administration details.
- Production needs durable amendment history, concurrency handling and server-side actor identity; the browser demo does not provide these guarantees.

## 14. Responsive behavior

- Desktop: patient board and patient detail panel side by side.
- Tablet: board with a detail drawer.
- Phone: compact patient cards, a bottom navigation bar and a full-screen patient panel. The bottom bar covers the app's destinations, with an overflow menu for those that do not fit comfortably.
- Keep both Tech and Vet assignments visible in the compact care-team presentation.
- Keep tabs readable and edit controls large enough for touch.
- Dialogs must fit the viewport and scroll when needed.
- Avoid horizontal page scrolling for the mobile patient list.
- Support keyboard tab navigation and visible focus.

## 15. What the current demo does and does not do

Implemented as browser simulations:

- Shared patient objects, role switch, role-specific controls and personal queues.
- Technician-first intake fields, optional attending vet, and unrestricted emergency assignment sequence.
- Consistent Care team display and explicit missing-assignment filters.
- Quick patient updates, vitals, care tasks, nursing observations, draft/sign-off snapshots, review requests and replies.
- Order lifecycle and administration linked to demo-authorized medication orders.
- Diagnostic tracking, handoff recording, coverage requests and discharge approval/preparation.
- Browser-local persistence and a downloadable self-contained HTML file.

Not implemented as production capabilities:

- Secure login, verified professional credentials or server-enforced permissions.
- Real-time synchronization between separate users, devices or browsers.
- Actual notifications, guaranteed delivery, emergency alerting or automatic escalation.
- Clinically validated vital thresholds, comprehensive triage rules or scheduling logic.
- Real prescriptions, clinical signatures, pharmacy integration, treatment authorization or medication verification.
- A tamper-resistant clinical audit record, concurrency protection or a production medical record.
- A complete discharge, billing, checkout, departure or client-communications system.
- A complete coverage acceptance demo for multiple veterinarian identities; the role switch currently offers one veterinarian and one technician.

The existing prototype interaction checks pass. Browser visual verification has been unavailable because the preview service is unavailable; responsive appearance still needs review on actual screen sizes.

## 16. Development decisions still required

- Confirm the hospital's credential groups, supervision rules, assignment/reassignment authority and acuity-downgrade policy.
- Define shared-pool accountability and coverage acceptance across multiple logged-in clinicians.
- Define concurrent editing, signed-record amendments and audit retention.
- Specify actual notifications, overdue alerts, acknowledgment targets and escalation routing.
- Define validated order fields, medication checks, clinical signature controls and diagnostic integrations.
- Confirm discharge gates, approved client instructions, checkout and departure states.

These open items do not change the agreed technician-first default, patient-based staffing model or one shared record.
