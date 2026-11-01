# VetiFlow — Patient History Access Recommendations

**Document type:** Product / UX development handoff  
**Scope:** ER Patient Overview and Patients → Visit History  
**Status:** Proposed enhancement; not yet implemented in the current ER prototype

## Objective

Allow authorized hospital staff to review a patient's previous ER visits and other encounters quickly, without confusing historical information with the active ER encounter.

## Recommended entry points

### 1. ER Board → Patient Overview → Patient Record

Keep the existing **Patient Record** area and its three quick-access buttons in their current visual style:

- **Clinical:** Review information from the currently selected ER encounter.
- **Medications:** Review medications relevant to the currently selected ER encounter.
- **Timeline:** Review events within the currently selected ER encounter.

Add a subtle, full-width **View Patient History** link row immediately beneath these buttons, with a history/folder icon and right-facing arrow. Do not add a visually competing fourth tile.

**On selection:** Open the selected patient's profile under **Patients**, with **Visit History** active. Preserve the selected patient identity and allow navigation back to the ER Board.

### 2. Main navigation → Patients

Navigation path:

**Patients → Search Patient → Patient Profile → Visit History**

Users should be able to find a patient even when they are no longer on the active ER Board.

## Patient Profile — Visit History

Display a list of encounters, newest first by default. Each entry should show, when documented:

| Field | Purpose |
| --- | --- |
| Visit date/time | Identify when the encounter occurred |
| Visit type | ER, outpatient, inpatient, or other configured visit type |
| Presenting complaint / reason | Quickly distinguish visits |
| Encounter ID | Unique reference for the specific visit |
| Encounter outcome/status | For example, active, discharged, transferred, or completed as supported by workflows |
| Attending clinician | Useful context when recorded and permitted |

Selecting an entry opens the **record for that encounter**, not a merged view of all clinical activity across the patient's lifetime.

### Historical encounter detail

Organize the encounter record into concise review areas (these need not be eight separate tabs):

- **Visit summary:** reason, triage acuity, clinical outcome, attending staff, encounter timestamps.
- **Clinical:** recorded vitals with measurement times, examinations, assessments, notes.
- **Medications:** medication orders, actual administrations, home medication reconciliation as recorded; distinguish each type.
- **Diagnostics:** laboratory results, imaging, reports, interpretations when documented.
- **Timeline:** intake, triage, care events, handoffs, reassessments, and departure, using true event times where known.
- **Tasks and care:** documented work, ownership, completion/review state.
- **Discharge:** final disposition, instructions, prescriptions and follow-up plan.
- **Communications:** authorized client-communication records where permitted.

## Important distinction: current vs. historical information

**ER Patient Overview → Timeline** = events for the **currently selected ER encounter**.

**View Patient History** = a list of **previous and current encounters** linked to the patient, from which an individual visit can be opened.

Do not display old medications, vitals, observations, or tasks as if they belong to the present visit. Clearly identify encounter date and ID when reviewing history.

## Discharge and historical retention workflow

1. The patient remains on the active ER Board while undergoing care and, where applicable, while awaiting pickup.
2. Clinical discharge authorization or clearance does **not** by itself mean the patient has physically departed.
3. After departure and appropriate encounter-state updates are documented, remove the encounter from the active ER census.
4. Retain the encounter and its linked records in **Patients → Visit History** subject to applicable record-retention and access policies.
5. Optionally provide **Recent Discharges** as a filtered view near the ER Board controls for convenient shift-level access. This is not a replacement for Visit History, and should not be an additional acuity lane.

## Data and implementation guidance

- Keep **one patient record** linked to **multiple encounters**; do not create a duplicate patient chart at discharge.
- Associate vitals, notes, medications, diagnostics, tasks, communications and discharge records with the correct encounter ID.
- Retain event time and record-entry time separately where the workflow permits retrospective documentation.
- Preserve staff attribution, signatures/review status, and an auditable amendment history.
- Restrict access to historical clinical and communication information according to verified role/field permissions.
- Handle unavailable records explicitly; never invent previous visits or assume missing information means a normal result.
- Reuse existing Clinical, Medications and Timeline review components where appropriate, while ensuring they are bound to the encounter the user selected.

## UX acceptance criteria

- [ ] ER Overview has a **View Patient History** entry beneath its existing three Patient Record buttons.
- [ ] Existing Patient Record buttons retain their current style and remain scoped to the active encounter.
- [ ] Clicking history opens the correct patient profile with **Visit History** selected.
- [ ] The Patients page supports patient search, including patients without an active ER encounter.
- [ ] Visits have identifiable dates, type, reason and encounter ID when recorded.
- [ ] Opening a visit shows only the data for that encounter, with clear encounter context.
- [ ] No stale information from another patient or encounter appears during navigation.
- [ ] A patient leaves the active ER census only when the documented departure/outcome rules require it.
- [ ] Historical records remain accessible according to clinic retention and role-access policies.
- [ ] Keyboard navigation, accessible labels and meaningful empty states are supported.

## Scope note

This document describes a **recommended navigation and history-review design**, not a claim that VetiFlow already has these workflows implemented. Final discharge transitions, permissions, record-retention rules and the Patients-page UI need product/clinical validation before production delivery.
