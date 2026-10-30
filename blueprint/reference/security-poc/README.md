# Security Lab portfolio MVP

Reviewed **2026-10-30**. This is a single-hospital, synthetic-data demonstration
of backend enforcement, separate from the normal clinical workspaces.

## Sources and placement

- [MVP specification](VETIFLOW_SECURITY_LAB_MVP_SPECIFICATION.md): behavioral
  scope, illustrative role matrix, negative tests and development-only boundary.
- [Focused HTML POC](VetiFlow_Security_Lab_Focused_POC.html): browser simulation
  of decisions/events, not real authentication, HTTP responses or persisted audit.
- [Master build plan](../../build-plan.md): **S.21a-e**, an optional slice within
  M3 before the larger M3b clinical workspaces. [Project plan](../../project-plan.md)
  retains the application-wide identity and real-data/launch requirements.

Finish the active 3.6a Clinical drawer work first. The portfolio slice can then
be explicitly prioritized without waiting for every My Patients feature or
enterprise IAM capability. It does not automatically reorder the ER queue.
The proposed three days are a timebox, not an implementation promise.

## Delivery mapping

| Scope | Master item | Evidence required |
| --- | --- | --- |
| Isolated local/test host/data, authenticated fictional actors, separate operator authority, production exclusion | S.21a | Actual trusted session identity; role/user_id spoofing fails; production route/execution/event access absent even with a flag |
| Server decision events and protected viewing | S.21b | Persisted allow/deny/anonymous decisions, safe reasons/correlation, operator access, clinical-account denial |
| Protected fictional reads, vitals writes and draft-order authorization | S.21c | Real 401/403/allowed responses; allowed mutation; denied clinical non-mutation with a persisted denial event |
| Separate development-only console | S.21d | Actual backend statuses/state/events; no simulated success fallback, clinical tabs or normal production navigation |
| Reproducible proof and portfolio documentation | S.21e | Isolated integration tests, production-exclusion checks, concise threat model/report/demo, honest limitations |

Identity/operator provisioning and the scenario-session design must be settled
before S.21a. An operator-controlled harness, if chosen, must use bounded known
fixtures and attribute the operator versus actual test actor honestly; it is
not a general-purpose command runner, arbitrary target proxy or client-supplied
role impersonation endpoint. Clinical callers still need direct negative tests.

## Reuse and boundaries

- Reuse the existing .NET/EF/Postgres/test-fixture and framework authentication
  stack where possible, including current Account/StaffMember and case/vitals
  logic. Do not create a second clinical patient system or change the app to
  SQLite just because the generic handoff lists that as an option.
- The current application distinguishes team members from owners but does not
  yet enforce the full veterinarian/technician/reception action matrix.
  CaseVitalsController currently permits team members until S.6. A secured Lab
  endpoint does not by itself secure unchanged application routes.
- There is no current clinical order-authorization endpoint to wire directly
  to the POC. Define a minimal explicitly fictional order fixture/store, or
  reuse the canonical order service when available. A Lab authorization must
  never become actual medication authority in 4.18/4.19.
- Full clinical role/assignment/credential policy remains S.6/3.7. Production
  identity remains S.5; sessions/rate limits/accounts retain their existing
  items. Lab proof does not mark any of them complete.
- S.21's operator-only security events and 8.1's manager-visible clinical audit
  have different read policies. They may reuse safe event infrastructure; a
  manager clinical role is not an automatic Security Lab operator grant.
- Test only an isolated synthetic local/test backend. Production exclusion
  must be enforced by the server, including direct requests; hiding a link or
  enabling DemoSignIn is not the Lab boundary. No hosted seeding, arbitrary
  database connection target or production test-action execution.
- Keep the normal ER/My Patients tabs off this separate surface. Shared visual
  tokens/clinic heading are appropriate; a normal clinical shell/access policy
  is not the operator console's security model.

## Review findings and POC-to-backend gaps

The HTML parses as JavaScript and clearly discloses simulation. Its execute
function makes no API request; its events are an in-memory array. These are
intentional POC limits, not evidence of implemented security.

1. **No anonymous test identity:** add actual unauthenticated protected-read
   tests expecting 401, rather than manufacturing a displayed status.
2. **No full-clinical-read denial scenario:** the POC's summary read allows all
   three demo roles. Backend proof must separately deny reception access to
   full clinical data while returning only permitted approved coordination data.
3. **Audit tab is visible under every selected demo role:** this does not model
   the separate operator boundary. Actual clinical-account audit requests must
   return 403; changing the selected role in JavaScript cannot grant access.
   Clear demo log is not an instruction to add server audit deletion.
4. **Extra client-communication write scenario:** it is beyond the minimal
   read/vitals/order scope and is not the same as approved-status read access.
   Keep it unbuilt/Coming soon unless explicitly added; do not infer a reception
   medical-note or approval permission from the POC's notes policy.
5. **Illustrative paths/statuses:** the POC prints patient/case-number paths
   and simulated 200 for allowed actions. Use the real API contract/domain IDs
   and actual success/error status, including 201 when applicable. An allowed
   authorization decision is not proof that persistence succeeded.

Denied actions leave clinical rows unchanged while a separate denial event is
persisted. Capture refusals that occur before controller execution as well as
allowed actions; avoid a handler-only audit design that misses middleware 401/403.
Use server timestamps, nullable/unknown actor details for anonymous requests,
safe reason codes and correlation IDs; never log tokens, passwords or raw notes.

The supplied specification and HTML remain unchanged. Their broader Coming soon
list stays outside this slice, and the complete application's launch/threat-model
review in 8.8 is not replaced by this limited portfolio exercise.
