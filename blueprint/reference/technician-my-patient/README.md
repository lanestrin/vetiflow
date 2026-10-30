# Technician My Patients

Requirements/prototype package received **2026-10-30**, specification version
1.1. The design is available; clinical authority and production workflow gates
remain. Share encounter data, shell/components and service contracts with the
veterinarian workspace and ER Overview.

## Sources

- [Development specification](VETIFLOW_TECHNICIAN_MY_PATIENTS_SPECIFICATION.md):
  behavior, role boundaries, acceptance criteria and policy requirements.
- [Enhanced HTML POC](VetiFlow_Technician_My_Patients_Enhanced_POC.html):
  illustrative interaction/hierarchy, not an exact visual/clinical specification
  or real medication authorization/notification/audit implementation.
- [Master build plan](../../build-plan.md), especially M3b, owns ordering and
  completion; [project plan](../../project-plan.md) owns shared constraints.

Keep one Patient Queue and a wider chart, the shared header, three neutral
white metric filters and adjacent acuity badges. Counts are distinct patients,
not staff performance. The technician's controls differ from veterinarian
authority; neither hidden UI nor a demo order confers permission.

## Requirement mapping

| Requirement | Shared work / technician consumer |
| --- | --- |
| Actual identity, permitted field/action access and shared reliability | S.5/S.6/S.7; 3.7; 2.2/2.4/2.5; audit 8.1 |
| Assigned/pool/all-active queue, search/filters and three counts | 2.22a/b, 4.3, 4.13; documented ownership and explicit missing/unsupported states |
| Care overview, Vitals & observations, Care tasks, Medications, Vet review requests, Handoff & escalation, Timeline, Discharge prep | 2.22d reads shared permitted sources; individual actions are gated separately |
| Measured vitals/assessment and nursing documentation | 4.11a-c, 4.15a/b, 4.8h; actual measurement/performance time versus server entry time |
| Performed care versus concern resolution | 4.13a-c; actual performer, assigner, creator, event/entry times and history stay distinct |
| Veterinarian review/sign-off/clarification requests | 4.16a/b, veterinarian actions 4.16c; sender cannot assert receipt/review/authorization |
| Urgent concerns and direct escalation | 4.17a/b, veterinarian response 4.17c; unconfirmed delivery and failure remain visible |
| Current/home medication reconciliation | 4.19a/b; reported/verified/unknown is separate from orders and actual administrations |
| Administration against a verified active authorized patient/order version | 4.18c/d authority, 4.19c/d MAR; read-only prescribed details, clarification/reasons/outcomes and actual performer/time |
| Diagnostics collection versus clinician interpretation | 4.20a/b; a performed task does not clear pending results/review |
| Handoff and accepted covering responsibility | 6.1a-d; receipt/acceptance and current cover are not inferred from a sent note |
| Discharge materials and education | 6.2c/d consume approved 6.2a instructions; no technician medical discharge authority |
| Follow-up and physical departure | 6.6/6.8, 6.2e/f; history access survives departure and preparation/readiness/checkout/departure remain distinct |
| Approved communication context | 6.4/6.5, 3.7; no automatic exposure of nursing drafts/internal concerns |

Review and MAR records must use the same IDs and history the veterinarian
views consume. An allowed coordination task is not an order. Pending review,
acknowledgment, medical authorization, performed care and clinical resolution
are separate transitions with server-side tests.

## Known POC issues from the reference review

These remain unfixed; corrections to prototype artifacts use /fix. The actual
features must follow the written requirements and regression cases below.

- **False measurement freshness:** entering only HR preserves older RR,
  temperature and SpO2, then gives the entire group the new measurement time.
  4.11a/c must preserve reviewed-new-set semantics (4.8e), or use an explicitly
  approved per-observation history model. Never silently retimestamp old values.
- **Unsigned note loss:** type a nursing note, switch tabs/patients or trigger
  a rerender before Save, and the text is discarded. 4.15b/4.8h must keep the
  input bound to its original encounter and protect pending/failed saves.

The demonstration medication guard correctly blocks entry when there is no
sample authorized order, but it is only a UI contract. Actual order identity,
patient match, active version/state, staff authority and concurrent holds or
discontinuation must be checked on the server in 4.19c.

## Decisions still needed

Permitted task and medication actions/credentials; required checks and reason
fields; measured/observed/entered actors and time validation; shared-pool and
All active rules; draft retention/recovery/visibility; urgent direct-contact
and escalation/receipt policies; recipient acceptance and unresolved follow-up.
Do not turn the POC's fictional medicine, dose, counts or times into defaults.

Triage remains the shared, separately authorized workflow, accessible for
unassigned arrivals rather than a new full triage subsystem on this page.
Activate normal sibling navigation when the authorized workspace is delivered;
standalone POC navigation being disabled is not a production requirement.
