# VetiFlow Security Lab — Three-Day Portfolio MVP

> **PROOF OF CONCEPT — NOT A PIXEL-PERFECT DESIGN SPECIFICATION.**
>
> **Security disclosure:** The accompanying HTML simulates access decisions and audit events entirely in the browser. It is not real authentication, authorization, or audit enforcement. Do not present simulated results as implemented backend security.

## 1. Purpose

Build a narrowly scoped, demonstrable security component of **VetiFlow**, for **Northside Veterinary Emergency** only, using fictional users and patient records. The objective is to show more engineering depth than basic JWT login by demonstrating meaningful, server-enforced clinical permissions, denied requests, and traceable security events.

**Scope:** One hospital; three staff roles; a few protected clinical actions; security event viewing. Multi-hospital support, HR workflow, and comprehensive hospital administration are out of scope.

## 2. Navigation and visual direction

- Retain VetiFlow's shared visual language, typography, colors, and **Northside Veterinary Emergency** heading.
- The Security Lab has its **own development-only navigation**, with **Security Lab** as the only active tab.
- **Do not show ER Board or My Patients tabs** on the Security Lab page. These belong to the separate clinical application prototypes.
- The Security Lab must not be accessible to ordinary clinical staff in a production environment. Prefer a dedicated development/test environment; disable the route and all test-execution endpoints in production.
- Maintain a visible **Proof of Concept** label and a clear explanation of simulated behaviors.
- Features outside the three-day build are labeled **COMING SOON** in the demo, not presented as working functionality.

## 3. Demo identities

Fictional single-hospital accounts:

| Identity | Role | Intended actions |
| --- | --- | --- |
| Dr. Jordan Reed | Veterinarian | View clinical record, record vitals, authorize clinical orders |
| Taylor Cruz, RVT | Technician | View permitted clinical record, record vitals, document authorized care; cannot authorize orders |
| Alex Morgan | Reception | View restricted patient coordination status and approved owner communication; cannot record vitals or authorize orders |

The Security Lab demo identity selector is **not authentication**. In a backend implementation, users must be identified from a trusted authenticated session; the client must not be allowed to submit arbitrary `role` or `user_id` values as authorization evidence.

## 4. Minimum portfolio behavior

1. **Authentication and sessions:** Prefer an established identity library/provider. Secure sessions and logout; avoid custom password/MFA cryptography. If full authentication cannot be implemented in time, isolate and clearly label the test identity mechanism and do not claim it is production-ready.
2. **Server-side action permissions:** Enforce permissions on every protected API handler. Hiding or disabling frontend buttons is not a security control.
3. **Clinical actions:** Implement a minimal patient-read endpoint, a vitals-recording endpoint, and an order-authorization endpoint backed by a small fictional database.
4. **Denied attempts:** A technician or receptionist attempting order authorization receives `403 Forbidden`. A receptionist attempting vitals entry receives `403 Forbidden`. Authorized changes persist; denied changes do not modify data.
5. **Security audit events:** Generate structured events on the server with actor identity, role, action, resource identifier, allowed/denied decision, timestamp, request/correlation ID and safe reason code. Never include tokens, passwords, or unnecessary patient details.
6. **Restricted event viewing:** Audit results must be available only to a development/security operator. Ordinary hospital roles should not gain access by visiting a URL directly.
7. **Repeatable tests:** Automated integration tests prove the allowed/denied outcomes, verify database non-mutation for denied actions, and confirm audit events are persisted.

## 5. Permission matrix (illustrative)

| Action | Veterinarian | Technician | Reception |
| --- | --- | --- | --- |
| View full permitted clinical chart | Allow | Allow | Deny |
| View approved client-facing status | Allow | Allow | Allow |
| Record vitals | Allow | Allow | Deny |
| Authorize medication order | Allow, subject to clinical workflow | Deny | Deny |
| Read Security Lab audit events | Deny | Deny | Deny |

**Clinical caveat:** Real authorization needs patient assignment, active professional privileges, hospital policy, licensing rules and order-specific checks. The table is a small portfolio demonstration, not a complete veterinary clinical authorization model.

## 6. Security test scenarios

| Scenario | Expected actual backend outcome |
| --- | --- |
| Technician records fictional patient vitals | Allowed; stored with user and event/entry timestamp |
| Technician authorizes medication order | `403`; order unchanged; denial event persisted |
| Reception records vitals | `403`; vitals unchanged; denial event persisted |
| Veterinarian authorizes a valid draft order | Allowed only after required validity checks; order status and audit event updated |
| Unauthenticated request for protected patient details | `401`; no record returned |
| Ordinary account requests audit event endpoint | `403`; no sensitive event details exposed |

Tests should be executed against a locally running, isolated backend using synthetic data. Don't confuse an HTTP status displayed by client JavaScript with a real response from the server.

## 7. Minimal data entities

- **users**: id, display_name, role, account_status, identity_provider_subject
- **patients**: id, name, species, stage, client_safe_status
- **vital_observations**: id, patient_id, measured_at, entered_at, entered_by, readings
- **orders**: id, patient_id, type, status, authorized_by, authorized_at
- **security_events**: id, actor_id, action, resource_type, resource_id, decision, reason_code, request_id, timestamp

For a portfolio demo, SQLite or PostgreSQL is sufficient. Use parameterized queries, foreign keys and server-side validation; keep demo secrets out of source control.

## 8. Out of scope — show **Coming soon**

- Enterprise MFA and SSO beyond available provider integrations
- Full HR → clinical approval → IT workflow
- Admin role editor and account invitations
- Account suspension and session revocation if not implemented
- Threat-detection engine and alert integrations
- Multi-hospital or tenant isolation
- Comprehensive clinical workflows and production deployment hardening

A feature labeled **Coming soon** is intentionally not claimed as implemented.

## 9. Three-day implementation order

**Day 1:** Minimal API, fictional seeded records, session/test identity boundary, permission matrix; test allowed and forbidden actions.

**Day 2:** Complete server checks and database consistency; append real security events and restrict event access; write negative tests.

**Day 3:** Connect a simple isolated Security Lab UI to real test calls; capture actual response statuses and events; create a concise threat model, README, test report and short demo recording. If behind schedule, prioritize verified enforcement and tests over UI polish.

## 10. Acceptance criteria

- [ ] Only one hospital is modeled.
- [ ] Security Lab contains no ER Board or My Patients navigation tabs.
- [ ] Role selection in the HTML demo is explicitly labeled simulated.
- [ ] Protected backend endpoints independently verify identity and permissions.
- [ ] Unauthorized clinical actions return real `403` responses and do not mutate records.
- [ ] Unauthenticated protected requests return `401`.
- [ ] Real server audit events are persisted for allow/deny decisions on sensitive actions.
- [ ] Clinical accounts cannot access the audit event API.
- [ ] Automated tests verify both permissions and records remaining unchanged after denial.
- [ ] Unbuilt features are labeled **COMING SOON**.
- [ ] Portfolio README accurately separates implemented features, simulations, and known limitations.

## 11. Guidance for Claude / implementation assistants

Use this Markdown as the behavioral scope and the companion HTML as a visual/interaction reference **only**. Do not copy the page as a pixel-perfect design. Preserve the current VetiFlow styling. Never treat client-side permission simulations or a fake event list as security. Implement critical controls on the server and prove them with tests. Do not broaden scope into multi-hospital support or a general-purpose enterprise IAM product.
