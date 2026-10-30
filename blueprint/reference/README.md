# Page requirements and design references

Keep a separate requirements/prototype package for each page or distinct
workspace, with one application-wide roadmap in [build-plan.md](../build-plan.md).
The [project plan](../project-plan.md) owns product-wide rules and shared data;
the active feature spec describes one small implementation PR.

## Current references

- [Patient Overview / ER Board](patient-overview/README.md): the current
  2026-10-30 requirements and behavioral proof of concept. Covers shared
  awareness and focused review only; it does not design My Patients or
  prescribe exact pixels, clinical ranges or sample medical findings.
- [Veterinarian My Patients](vet-my-patient/README.md): the supplied enhanced
  clinical-workspace requirements and POC, with its shared API dependencies
  and separate note/order/review/discharge authority.
- [Technician My Patients](technician-my-patient/README.md): the supplied
  care/observation/MAR/review/handoff/discharge-preparation requirements and
  POC. It shares records with the veterinarian view, not its clinical privileges.
- [Security Lab](security-poc/README.md): the isolated single-hospital portfolio
  slice (S.21a-e), with actual backend permission/audit proof planned separately
  from the browser simulation and from production clinical authorization.
- The role designs are available; implementation and clinical-policy gates
  remain. The hidden old workspace in the ER HTML is not a substitute for them.
- [Original sign-in mock](login-poc/vetiflow-login-mock.html): the relocated
  S.18 reference; its content is unchanged. Later landing-page work has its
  own history and should not be reset to this old mock.
- `vetiflow_icon.svg`: the app icon.
- The removed vitals/pain screenshot is historical; delivered behavior is
  documented in [4.8b](../history/features/4.8b-vitals-tiles.md) through 4.8e.
  It is not authority for a new generic ER Overview pain slider.

## Adding a future page

Use `blueprint/reference/<page-name>/` with:

- A requirements document: purpose, audience, scope, workflows, actual data
  sources, permissions, missing/error states, acceptance criteria and open
  decisions. Identify what changed and when.
- A prototype or screenshots, explicitly labelled exact visual reference or
  behavioral proof of concept. State what is illustrative rather than approved.
- A README: current files, source precedence, requirement-to-build-ID mapping,
  shared dependencies and unresolved decisions. Keep completion checkboxes in
  the master build plan, rather than duplicating a second build queue here.

When a revision arrives, compare it with existing code and previous decisions,
update affected master items, and record superseded proposals without rewriting
completed history. Add missing shared API/model work before dependent screens;
reuse the same encounter, task, communication and authorization sources across
pages. Do not activate a page from unrelated or obsolete prototype markup.

Current written requirements and explicit user decisions take precedence over
prototype artifacts. An exact visual reference guides appearance within those
requirements; a proof of concept explores behavior and hierarchy only. Neither
fictional clinical values nor a browser role selector define production rules.
