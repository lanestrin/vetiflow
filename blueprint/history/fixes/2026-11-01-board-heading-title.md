# Fix: ER board heading matches the prototype

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/board-heading-title`
- **Audit:** not needed - heading text and styles only; no data, auth or owner-scope change.

## The problem

The reference
`blueprint/reference/patient-overview/VetiFlow_Responsive_Navigation_Improved.html`
(line 75) shows the heading as a small teal eyebrow "Northside Veterinary
Emergency" above the h1 "ER Command Center", then the subtitle. Our board shows
the clinic name as the h1 and no "ER Command Center" title
(`vetiflow.client/src/components/board/BoardHeading.tsx:15`). Open `/er` to see it.

That is on purpose today: the 2026-10-29 readability fix
(`history/fixes/2026-10-29-dashboard-readability-demo-data.md`) removed the
title at the user's request, and `project-plan.md` (Dashboard presentation
update, 2026-10-29) records "the clinic name is the main heading; omit the
repeated ER Command Center heading below it". The user now asks for the
prototype's layout, so this fix reverses that decision.

## The fix

- `BoardHeading` renders the clinic name from the summary as an eyebrow paragraph
  (not a heading), then the h1 "ER Command Center", then the subtitle.
  - While the summary is unavailable, the eyebrow is left out and the h1 still reads
    "ER Command Center". The "Emergency board" fallback goes away.
  - One h1 on the page, as now. The shift chip and New intake button do not change.
- Styles follow the reference with the readability floor from 2026-10-29:
  - eyebrow: teal (`--color-care-teal`), uppercase, 700 weight, 1.2px letter
    spacing, 7px below, at 0.75rem (the reference's 11px is under the 12px
    minimum for compact labels);
  - title: 800 weight, -0.7px letter spacing, 1.6875rem (27px), 1.4375rem (23px)
    at 650px and below, still wrapping.
- Update the 2026-10-29 line in `project-plan.md` to say the clinic name is the
  eyebrow above the "ER Command Center" h1 (2026-11-01).

## Build steps

- [x] **Step 1 - failing test.** Change `BoardHeading.test.tsx` to expect the h1 "ER Command Center" with "Northside Veterinary Emergency" as text that is not a heading, and no eyebrow but the same h1 while the summary is null. *Done when:* `npm run test -- --run BoardHeading` fails on those expectations against the current component.
- [x] **Step 2 - fix.** Change `BoardHeading.tsx` and `BoardHeading.module.scss` as above; update the board heading expectations in `ErBoardPage.test.tsx` and `App.test.tsx` (the `/er` heading) to "ER Command Center"; update the `project-plan.md` line. *Done when:* `BoardHeading.test.tsx`, `ErBoardPage.test.tsx` and `App.test.tsx` pass, and the whole client suite and lint pass.

## Files / areas

- `vetiflow.client/src/components/board/BoardHeading.tsx`, `.module.scss`, `.test.tsx`.
- `vetiflow.client/src/routes/ErBoardPage.test.tsx` (heading expectations only).
- `vetiflow.client/src/app/App.test.tsx` (the `/er` heading only).
- `blueprint/project-plan.md` (the 2026-10-29 dashboard presentation line).

## Verify

- `BoardHeading.test.tsx` proves it; the client suite and lint.
- In the app: `/er` at desktop shows the teal uppercase "Northside Veterinary
  Emergency" above "ER Command Center", then "Live patient flow and care
  coordination"; at 430 px the heading stacks with no horizontal scroll.

## Notes for the AI

- The browser tab title (`ER Board · VetiFlow`) and the breadcrumb ("VetiFlow / ER
  Command Center") stay as they are.
- `buildBoardSummary` already defaults `clinicName` to "Northside Veterinary Emergency".

## Open questions

None, if you confirm the reversal: approving this spec replaces the 2026-10-29
"omit the repeated ER Command Center heading" decision.

## Result

- **Prepared:** branch `fix/board-heading-title`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-01, scope client (reused from 2026-11-01T22:16:37Z, fix/board-heading-title @ 701fa4e)
  - PASS  Workflow tests
  - NOT_APPLICABLE  Client install (installed lockfile is current)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
  - Not needed: server steps (no server files changed)
- **Step 1 evidence:** `BoardHeading.test.tsx` failed 2 of 3 tests against the old component before the fix.
- **Check:** not run. No *Done when* needs the running app; the desktop and 430 px views have not been seen in a browser.
- **Audit:** not needed.
- **Follow-ups added to build plan:** none. Fix 3 (the bell's ping dot) follows as its own `/fix`.
- **Deploy notes:** none.
