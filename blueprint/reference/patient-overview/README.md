# ER Board and Patient Overview

Current product-direction revision: **2026-10-30**. This package describes the
shared ER coordination screen, not a complete medical chart or My Patients.

## Sources and precedence

1. [Development specification](VETIFLOW_ER_OVERVIEW_SPECIFICATION.md): intended
   content, workflows, boundaries, acceptance criteria and open decisions.
2. [HTML prototype](VetiFlow_ER_Overview_Next_Care_Action.html): behavioral proof of
   concept. Inspect its final state and scripts, not just its original markup;
   it is not an exact production layout or an authorization implementation.
3. [Project plan](../../project-plan.md) and [master build plan](../../build-plan.md):
   shared constraints, implementation dependencies and stable work IDs.

The current prototype is `VetiFlow_ER_Overview_Next_Care_Action.html`. The previous
Shared Status POC and top-level `vetiflow-er-dashboard.html` are superseded.
Historical feature documents retain their original references.

The HTML retains legacy pain controls, clinical-entry demos and My Patients
markup/listeners, and still contains old headings, small text and font weights.
Later scripts hide/rearrange parts of that markup. The written requirements
take precedence: no generic Overview pain slider, My Patients inactive until
its role implementation is ready, and
the current clinic heading/design system/readable typography retained. Do not
copy fictional medications, sample clinical priorities or demo thresholds into
production data or make them the application's default clinical rules.

## Implementation mapping

Completion and order live only in the master build plan. Delivered 4.8a-e and
other historical items stay completed; a new reference does not erase them.

| Requirement | Existing foundation / gap | Master work IDs |
| --- | --- | --- |
| Header, board selection, acuity lanes and responsive navigation | Clinic heading/stats/filters already exist. Current phone lane tabs must be accounted for when removing the redundant pill strip. | 2.23; preserve 2.11/2.12/2.14/2.15 |
| Compact identity, complaint, care stage and location | Case detail already has these fields; the panel lacks the new hierarchy. Keep missing values honest. Stage vocabulary is still an open hospital decision. | 2.23, 4.9a/b, 4.3a/b |
| Focused Clinical / Timeline / Medications review | Reuse current vitals/observations, events and medication text first; one drawer open at a time, correctly bound to the selected encounter. No new full chart form. | 3.6a/b/c, then S.6 and 3.7a/b for field-level role filtering |
| Next documented action, responsible person and reassessment | Existing nextAction/tasks/due items are useful, but lack the approved priority/review/assignment-history rules. Do not choose the case doctor as the action assignee by assumption. | 2.23 for honest existing data; 4.13a/b for the richer shared source |
| Numeric vitals and freshness | RecordedAt is currently entry time. Actual measured time and configured staleness are missing; old readings cannot be relabelled as measured at entry time. | 4.11a/b; validated alerts separately in 4.14a/b |
| Saved changes and attribution | Keep the requested persistent comparison in deeper review, using saved records and truthful event/entry times. Do not expand the compact panel into a history ledger. | 4.8g after 3.6a/b and 4.11a |
| Assessment details and pain | MM/CRT/mentation already persist and are shown by 4.8e; relocate their review access rather than deleting data. No generic slider. Future species-specific assessment needs an approved protocol and clinical workspace. | 3.6a, 2.23, deferred 2.22a/b; 4.8f is superseded |
| Allergy safety and care-team context | Allergies are free text without verification status; doctor/technician/room fields exist, but assignment writes and shared-pool policy remain. Unknown is not verified no known allergies. | 4.12a/b, 4.3a/b |
| Last approved client update and next update | Current OwnerUpdateStatus/LastOwnerUpdateAt and a client-update task do not establish an approved note or identify its communicator/approver. | 6.4a/b, 6.5a/b, S.6, 3.7a/b; owner page 6.3 reuses this source |
| Draft protection and legacy entry access | Keep the earlier unsaved-change request without building the prohibited slider. Preserve working entry access until a clinical-workflow cutover is approved. | 4.8h; entry-cutover decision before 2.23 |
| Outcomes and active census | Existing active-case/room rules use DischargedAt. Clearance must not silently become departure; outcomes and active-query/index changes need a coordinated design. | 6.2a/b, 6.7 and the outcome decision |
| My Patients and deeper clinical documentation | Both dedicated role designs are supplied. Use their shared shell/read models and separate role controls; do not implement the old embedded workspace. | 2.22a-d; shared clinical work in M3b, S.6 and 8.1 |

## Incremental order

Start with **3.6a**, a Clinical review drawer using data already available in
the staff demo. Follow with Timeline and Medications review, then preserve
drafts through 4.8h. The compact-panel cutover (2.23) requires an explicit plan
for existing entry actions while My Patients is inactive; do not strand those
workflows or copy legacy full forms into read-only drawers.

Add measured times, structured safety data, documented priorities and approved
communication through their shared API/model items before claiming the richer
screen states are supported. Per-role read projections and policies must exist
before mixed clinical/reception access is enabled. These requirements do not
make the existing team-member demo production-ready.

## Decisions still needed before affected features

- Care-stage vocabulary/transitions and which outcome/departure events remove
  a patient from the active board or release a room.
- Explicit clinical-priority selection, review status and due-soon tie-breaking.
- Role/field/action permissions, approved client-note authority and escalation.
- Measurement/event-time entry, unknown historical values and clinic freshness
  policies, including validated clinical-alert context.
- Optional primary technician versus documented shared-pool responsibility.
- Where retained documentation actions live during the transition to the
  supplied role designs, plus the applicable approved species-specific assessments.

Clinical/product decisions remain open in the master plan; this mapping does
not choose medical thresholds, treatment recommendations or permission grants.

## Known prototype issue from the reference review

The final ER script reads `window.caseInfo`, while the data is a top-level
`const caseInfo`. Headless interaction reproduced Location = Not recorded
and Reassessment = Not scheduled despite existing values in that patient's
sample record. This prototype issue remains unfixed. Correct the artifact
through /fix if needed; 2.23/3.6 must test real data-source binding and must not
copy the false missing-state behavior. The written requirements govern.

## Role workspace references

See [Veterinarian My Patients](../vet-my-patient/README.md) and
[Technician My Patients](../technician-my-patient/README.md). Their documented
updates feed this shared summary through common records and permission-filtered
projections; a write on either page does not create a second ER encounter copy.

## Future page packages

Use the same three-part package for My Patients, Patients/Records, Team,
Reports or the owner page: requirements, prototype(s), and this kind of mapping.
Each package links to the same master roadmap. Add a separate per-page build
queue only if the project later has an explicit need for independent releases;
do not duplicate dependencies or completion state by default.
