# ER board prototype (2026-11-02, revised the same day)

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
  browser storage and JavaScript role guards are not requirements. Replaced
  2026-11-02 by the designer's revision: one scrolling surface for the record,
  the compact patient header and the compact page header. Its sort was
  corrected to **Time in stage ↓** before it became the reference (Board sort
  decision).
- [header.png](header.png): the designer's compact page header, added
  2026-11-02. The heading and the shift / New intake layout are built in
  2.26b; the demo-role row in 2.28. Its bell and signed-in user stay in the
  app's top bar instead (Record panel and page header decision).
- [record-header.png](record-header.png): the compact patient record header, captured
  from the HTML's `.patient-sticky` at 1440 px on 2026-11-02 (3.2f), since the
  designer supplied no screenshot of it.
- [board-toolbar.png](board-toolbar.png): the board top (title, All patients / My
  patients) and toolbar (search, Unassigned, Filter, Time in stage ↓), captured
  from the HTML at 1440 px on 2026-11-02 (2.26b).
- Screenshots of the prototype's patient record, added 2026-11-02 by the
  person. Every patient record component is built and checked against them as
  well as the HTML:
  - [Overview.png](Overview.png): header, tabs, Latest vitals, Next care action, review banner, Care tasks, Care team & safety, Presenting complaint, save status.
  - [Clinical.png](Clinical.png): Examination & treatment plan, signed documentation and nursing notes, Vet review requests, Diagnostics & follow-up, Handoff & escalation, Discharge.
  - [Orders & Medication.png](Orders%20%26%20Medication.png): Orders with Draft order, Administration records.
  - [TimeLine.png](TimeLine.png): Patient timeline.

## Checking a component against the prototype

Each UI spec lists every element of the matching HTML section and screenshot
as one of: built in this item; different by a named decision; or deferred to a
named build item. After building, the running app is captured in the same view
and compared with the screenshot and HTML before the work is reported.

## Source precedence

1. The person's decisions in [build-plan.md](../../build-plan.md) (Decisions),
   including the 2026-11-02 Board layout, Patient header quick edits, Demo role
   switch, Navigation, Assignment order, Board sort and Record panel and page
   header decisions. Where the prototype conflicts with a decision, the
   decision wins.
2. `VetiFlow-Product-Rules.md`.
3. `VetiFlow-ER-Prototype.html`.

The app keeps its design system, readable type, 1px focus and 700 bold, its
six navigation destinations and its server-side checks.

## Requirement to build ID

| Requirement (product rules section) | Build item |
| --- | --- |
| Board table on desktop, cards on phones (3) | 2.25 |
| Patient header, four tabs, stage and location buttons (4) | 3.2c |
| One scrolling record surface, compact patient header, close ✕ | 3.2f |
| Overview tab order: vitals, next care action, care team & safety, complaint, save state (4) | 3.2d, with 4.13b for the Next care action |
| Compact summary strip, All / My patients, search, Unassigned, filters, time-in-stage sort within the fixed acuity order (2, 3; Board sort decision) | 2.26 |
| Desktop / tablet drawer / phone layouts, bottom bar (14) | 2.27 |
| Demo role switch and role-specific controls (5, 6) | 2.28 |
| Technician-first assignments at intake (2) | 4.1c |
| Clinical drafts and sign-off, nursing notes (7) | 4.15a-d, 4.11c |
| Care tasks performance and history (8) | 4.13c |
| Review requests and escalation (9) | 4.16a-c, 4.17a-c |
| Orders and medication administration (10) | 4.18a-d, 4.19a-d |
| Diagnostics and follow-up (11) | 4.20a-b, 6.8a-b |
| Coverage, handoff and discharge (12) | 6.1a-d, 6.2a-f |
| Real roles and permissions (6) | Not planned (S.6 and 3.7a-b dropped 2026-11-03: demo only) |
| My patients workspaces for each role (1, 3) | 2.22a-d |

## Deferred or not built

- The prototype's complaint Edit action (decision: read-only for now).
- Inline stage and location dropdowns (decision: header buttons and modals).
- The prototype's reduced rail (decision: the app keeps its navigation).
- Browser-local persistence of clinical data, demo sign-off and demo order
  authorization: the clinical items above build these on the server.
