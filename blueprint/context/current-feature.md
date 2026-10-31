# Feature: Compact ER Patient Overview

**From build-plan:** feature 2.23
**Status:** in progress
**Branch:** `feature/compact-er-overview`
**Audit:** recommended - changes application UI and moves clinical entry actions while keeping them case-bound.

## Goal

Make the selected-patient panel a readable, compact coordination summary, with
recorded stage, location, next action, vitals, safety/team and client-update
context. Keep the existing read-only Clinical, Medications and Timeline
drawers. Remove full chronology, inline task lists and the unsupported generic
pain-score UI from the summary without stranding existing task, due-item,
triage or vitals workflows.

## Design reference

- Requirements and precedence: `blueprint/reference/patient-overview/README.md`
  and `VETIFLOW_ER_OVERVIEW_SPECIFICATION.md`.
- Behavioral prototype:
  `blueprint/reference/patient-overview/VetiFlow_ER_Overview_Next_Care_Action.html`.
  This is **not** a pixel-perfect specification. Use the existing VetiFlow
  design system, readable typography and responsive/accessibility standards;
  do not copy demo facts, thresholds, unsupported states or small text.
- Preserve the application header, board stats, Filter/Priority, acuity lanes
  and the phone lane tabs. Do not remove the phone tabs as a substitute for
  removing redundant acuity-filter pills.

## In scope

- Replace the panel's current long chronology/task-heavy presentation with a
  concise hierarchy supporting:
  - patient identity, documented demographics, case number and acuity;
  - presenting complaint;
  - care stage distinct from acuity and latest documented location;
  - the existing documented next action and reassessment with honest missing
    states; show an action assignee only when explicitly available, never infer
    it from the assigned doctor;
  - latest HR, RR, temperature and SpO₂, with units and entry time/recorder
    when available. Render values neutrally; `recordedAt` is entry time, not
    verified measurement time;
  - allergy information with verification unknown unless the data explicitly
    proves otherwise, and the assigned doctor/technician or clear unassigned
    states;
  - last update timestamp and next planned client update only from existing
    fields. Do not imply approval, identify a communicator or show a
    client-facing note when the API does not provide those facts;
  - existing Clinical, Medications and Timeline read-only quick-access
    drawers.
- Keep detailed observations and chronology in Clinical/Timeline review rather
  than repeating them inline. Keep detailed task completion in a focused task
  view opened from More actions.
- Move currently working task creation, task completion/reopen, due-item
  scheduling/completion, triage/re-triage and Record vitals entry access to
  More actions and the task view, as appropriate. Preserve their existing
  APIs, validation, reload behavior, error handling and case binding.
- Remove the generic pain-score panel and its ER Overview entry action. Remove
  its overview-only components/dialog code and tests only if repository search
  confirms they have no other callers. Preserve persisted pain records and
  API contracts; do not add a different pain assessment.
- Keep the panel's loading, failure, not-found, no-selection, patient-switch,
  auth-refusal and discharged-case behavior correct.

## Out of scope

- Pixel-for-pixel recreation of the HTML; changing the clinic heading or
  board-wide statistics and controls.
- New API/model fields, migrations, role/field authorization, clinical
  thresholds, vitals measured-time or freshness policy, allergy verification,
  approved communication notes/communicator, or documented task priority and
  assignment history.
- Selecting a highest-priority task using new policy; do not invent ordering
  or use `assignedDoctor` as an action assignee.
- Implementing My Patients or replacing the existing forms with new clinical
  workflows. Draft protection is 4.8h, a separate build-plan item.
- Deleting stored pain data or server support.

## Data and display rules

- Use the loaded `CaseDetail` for the selected encounter; do not add a second
  fetch or local patient map.
- Use the existing case stage and stage-label helper. Do not infer stage from
  acuity, room, task state or event text.
- Use `presentingComplaint`, `room`, `nextAction`, `nextReassessment`,
  `nextClientUpdate`, `vitals`, `allergiesAtIntake`/patient allergy text,
  `assignedDoctor`, `assignedTechnician`, `ownerUpdateStatus` and
  `lastOwnerUpdateAt` only according to what each field establishes.
- Do not claim allergy verification from free text. Do not say “no known
  allergies” unless the source explicitly represents a verified negative.
- Do not relabel `VitalsRecord.recordedAt` as when measured or show a
  fabricated freshness/abnormal state. Missing values remain “Not recorded.”
- The current contract has no approved client-note text or communicator.
  Distinguish absent recorded update data from proof that the family was not
  contacted.
- Preserve all backend data and actions when hiding details from the compact
  panel.

## Build steps

- [x] **Step 1 - compact summary and focused task surface.** Add/adjust focused
  panel and task-view tests first. Implement the summary hierarchy and move
  detailed tasks/actions to a case-bound task view launched from More actions.
  Keep the view accessible, keyboard-operable, responsive and safe on selection
  changes; preserve existing single-open review drawer behavior.
  *Done when:* `PatientOverviewPanel.test.tsx` verifies each supported summary
  field and its missing/unknown state, distinct stage/acuity, neutral vitals
  with recorded-time wording, read-only review buttons, no inline full
  chronology/task list/pain panel, case-bound task review, and every moved
  action's enabled/disabled and save/reload behavior. No patient data or open
  view leaks across selection, loading, refusal or failure.
- [ ] **Step 2 - remove obsolete overview UI and verify responsive behavior.**
  Remove unused pain UI code/styles/tests after confirming no callers, remove
  styles made obsolete by the cutover, and check the changed panel/task view at
  wide and narrow widths, keyboard use and text zoom.
  *Done when:* client tests, lint and build pass; `/check` confirms the summary
  and task actions remain usable at desktop and narrow widths, review drawers
  still work, patient switching is safe, and no horizontal page overflow or
  clipped controls appear. `git diff --check` passes.

## Files / areas

- Update `vetiflow.client/src/components/overview/PatientOverviewPanel.tsx`,
  `.module.scss` and `.test.tsx`.
- Update `MoreActionsMenu.tsx`, its styles/tests, and `ErBoardPage.tsx` only as
  needed to preserve existing action callbacks.
- Add a focused case task view/dialog and tests under
  `vetiflow.client/src/components/overview/` if existing dialogs cannot
  preserve checklist and due-item workflows after removing the inline list.
- Remove the overview-only `PainScorePanel` and `RecordPainScoreDialog`
  component/test/style files only after confirming no other callers.
- Do not change server contracts, persistence or migrations.

## Testing

- Client focused tests: `PatientOverviewPanel.test.tsx`, task-view tests,
  `MoreActionsMenu` tests, and any affected route tests.
- Run the client checks selected by `scripts/verify.ps1` through `/ready`.
- `/check`: observe at desktop and narrow widths, keyboard navigation, 200%
  text sizing, every preserved entry action, patient switches and all three
  review drawers. Record any browser or assistive-technology limitations.

## Dependencies and decisions

- Delivered 3.6a/b/c provide the read-only review drawers. Keep their contents
  and case-bound lifecycle intact.
- Existing plan item 4.8h remains separate and follows this cutover as agreed;
  this item must not add unsaved-draft behavior.
- Current case-stage vocabulary is displayed as stored; this feature does not
  choose new hospital transitions. The richer clinical, safety and approved
  communication fields remain blocked on their documented data/permission
  work.
