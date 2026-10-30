# Veterinarian My Patients

Requirements/prototype package received **2026-10-30**. The design is available;
implementation, permissions and the listed clinical-policy decisions remain.
This is one role workspace over shared records, not a separate patient system.

## Sources

- [Enhanced development specification](VETIFLOW_VETERINARIAN_MY_PATIENTS_ENHANCED_SPECIFICATION.md),
  including its enhanced-workflow addendum, defines intended behavior and gates.
- [Enhanced HTML POC](VetiFlow_Veterinarian_My_Patients_Enhanced_POC.html) explores
  the interaction/hierarchy. It is not an exact layout, clinical-rule source,
  real authorization/signature implementation or durable record store.
- [Master build plan](../../build-plan.md), especially M3b, owns dependency
  order and completion. [Project plan](../../project-plan.md) owns shared rules.

Keep the shared clinic header and one Patient Queue/wide chart. Three white
metric cards filter distinct patients; draft state belongs on patient cards.
Use acuity beside names and current design tokens/readable type; no separate
attention sidebar, fourth draft metric or staff productivity scoring.

## Requirement mapping

| Requirement | Shared work / veterinarian consumer |
| --- | --- |
| Server identity, clinical privileges and private reads | S.5/S.6/S.7; 3.7; never a browser role selector |
| Shared queue, assignment/search/filters and chart scaffold | 2.22a/b, 4.3, 4.13; distinct patients, approved All active semantics |
| Clinical overview, Exam & plan, Orders, Tasks & reviews, Timeline, Discharge | 2.22c reads existing permitted records; later actions arrive independently |
| Measured/entry times, allergy status and documented next priority | 4.11, 4.12, 4.13; never false normal/verified states |
| Exam/plan drafts and recovery | 4.15a/b plus 4.8h, 2.2/2.4/2.5; server-owned drafts and encounter-bound pending input |
| Explicit signing, immutable versions and amendments | 4.15c/d, 8.1; signing policy/credential verification first |
| Request receipt, clarification, clinical review and resolution | 4.16a/c; linked technician entry 4.16b; no automatic authorization |
| Urgent concerns and response ownership | 4.17a/c; technician entry 4.17b; direct-contact and delivery/fallback policy first |
| Typed order drafts and precise authorized versions | 4.18a-d; no universal per-type state machine copied from demo |
| Medication reconciliation versus actual MAR | 4.19a-d; veterinarian authorization is distinct from technician performance |
| Pending diagnostics, interpretation and accountable follow-up | 4.20a/b, 6.6/6.8; completed collection never closes an unreviewed result; departed patients stay accessible through permitted history/follow-up access |
| Handoff and temporary coverage | 6.1a-d; keep attending, cover, accepting recipient and historical authors distinct |
| Approved client communication | 6.4/6.5 and 3.7; internal drafts/escalations do not become client notes |
| Medical readiness/authorization and later departure | 6.2a/b, technician prep 6.2c/d, departure 6.2e/f, follow-up 6.8 |

Reuse EmergencyCase as the existing encounter concept and the shared staff,
task, handoff and history sources. New domain contracts/migrations are shared
with the technician and ER views; suggested entity names are not instructions
to duplicate or rename tables. No page maintains writable shadow status.

## Known POC issues from the reference review

These remain unfixed; prototype corrections use /fix. The requirements and
the master items below require correct behavior even if the demo is unchanged.

- **Pending draft loss:** type a note and change patient before the 450 ms
  autosave fires. The callback reads the current patient/DOM after navigation
  and the original input is lost. 4.15b/4.8h must capture the original context,
  flush or protect pending edits and test rapid patient/tab/filter switches.
  Pending autosave must also not recreate a draft after explicit signing.
- **Attention undercount:** complete the patient's ordinary tasks while its
  urgent escalation remains unacknowledged. The POC attention predicate/count
  uses tasks only, excluding that patient. 2.22a/b and 4.17c must keep explicit
  unresolved escalation/result-review responsibility visible independently of
  task completion, under the approved attention rules.

## Decisions still needed

Clinical action privileges and credentials; signing/co-signature requirements;
per-order transitions; attention/filter/assignment/cover semantics; urgent
delivery, fallback and accepted response ownership; secure draft recovery and
conflicts; follow-up after departure. The specification's illustrative status
names and in-memory audit/sign-off are not production policy or evidence.

Normal application navigation is enabled as authorized views are delivered.
The standalone prototype's non-navigating ER Board link does not prescribe
disabled sibling navigation in the finished application.
