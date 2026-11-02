# ER board prototype (2026-11-02)

The current source for the ER board, the patient record and the shared
veterinarian / technician model. It replaces the earlier `patient-overview/`,
`vet-my-patient/`, `technician-my-patient/` and `patient-history/` packages.

## Files

- [VetiFlow-Product-Rules.md](VetiFlow-Product-Rules.md): the requirements.
  Product rules for the board, record, assignments, demo role switch, role
  permissions, clinical documentation, tasks, reviews, orders, discharge and
  responsive behaviour.
- [VetiFlow-ER-Prototype.html](VetiFlow-ER-Prototype.html): a standalone
  browser prototype with fictional data. It guides visual hierarchy and the
  shared patient record; it is not a pixel-exact design, and its demo values,
  browser storage and JavaScript role guards are not requirements.

## Source precedence

1. The person's decisions in [build-plan.md](../../build-plan.md) (Decisions),
   including the 2026-11-02 Board layout, Patient header quick edits, Demo role
   switch, Navigation and Assignment order decisions.
2. `VetiFlow-Product-Rules.md`.
3. `VetiFlow-ER-Prototype.html`.

The app keeps its design system, readable type, 1px focus and 700 bold, its
six navigation destinations and its server-side checks.

## Requirement to build ID

| Requirement (product rules section) | Build item |
| --- | --- |
| Board table on desktop, cards on phones (3) | 2.25 |
| Patient header, four tabs, stage and location buttons (4) | 3.2c |
| Overview tab order: vitals, next care action, care team & safety, complaint, save state (4) | 3.2d, with 4.13b for the Next care action |
| Compact summary strip, All / My patients, search, Unassigned, filters, priority sort (2, 3) | 2.26 |
| Desktop / tablet drawer / phone layouts, bottom bar (14) | 2.27 |
| Demo role switch and role-specific controls (5, 6) | 2.28 |
| Technician-first assignments at intake (2) | 4.1c |
| Clinical drafts and sign-off, nursing notes (7) | 4.15a-d, 4.11c |
| Care tasks performance and history (8) | 4.13c, 4.13e |
| Review requests and escalation (9) | 4.16a-c, 4.17a-c |
| Orders and medication administration (10) | 4.18a-d, 4.19a-d |
| Diagnostics and follow-up (11) | 4.20a-b, 6.8a-b |
| Coverage, handoff and discharge (12) | 6.1a-d, 6.2a-f |
| Real roles and permissions (6) | S.6, 3.7a-b |
| My patients workspaces for each role (1, 3) | 2.22a-d |

## Deferred or not built

- The prototype's complaint Edit action (decision: read-only for now).
- Inline stage and location dropdowns (decision: header buttons and modals).
- The prototype's reduced rail (decision: the app keeps its navigation).
- Browser-local persistence of clinical data, demo sign-off and demo order
  authorization: the clinical items above build these on the server.
