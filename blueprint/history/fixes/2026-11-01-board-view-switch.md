# Fix: Board view switch matches the prototype

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/board-view-switch`
- **Audit:** not needed - a visual control with no data, auth or owner-scope change.

## The problem

The ER board has no view switch. The reference
`blueprint/reference/patient-overview/VetiFlow_Responsive_Navigation_Improved.html`
(and the ER overview prototype) shows a segmented control under the heading: an
**ER board** tab (selected) and a **My patients** tab, followed by the hint text
"Shared patient record · role-focused workspace". Our board renders the heading,
then the stats, with nothing between them. The user noticed this from a screenshot.

My patients is not built yet (build plan M3b), so its tab cannot open anything.

## The fix

- Add a `BoardViewSwitch` component: a tablist labelled "Dashboard view" with two
  tabs and the hint text.
  - **ER board** is selected (`aria-selected="true"`) and is the current view.
  - **My patients** is shown but disabled (`disabled`, with the title "Coming soon"),
    because the workspace it would open is not built. The reference keeps My Patients
    inactive too (`reference/patient-overview/README.md`: "Keep My Patients inactive").
  - The hint text is visible at desktop and phone width, as in the screenshot.
- Place it in `ErBoardPage` between `BoardHeading` and `BoardStats`, with the spacing the
  reference uses (about 18 px below).
- Styles follow the reference: a pale segmented track, a white selected tab with a soft
  shadow, muted text for the other tab, and the design tokens already in the app.

## Build steps

- [x] **Step 1 - the component.** Add `BoardViewSwitch` and its stylesheet. *Done when:* `BoardViewSwitch.test.tsx` shows a tablist named "Dashboard view" with "ER board" selected, "My patients" disabled with the title "Coming soon", and the hint text "Shared patient record · role-focused workspace"; and the whole client suite passes.
- [x] **Step 2 - the board.** Render `BoardViewSwitch` in `ErBoardPage` between the heading and the stats. *Done when:* `ErBoardPage.test.tsx` shows the switch after the heading and before the stats; `App.test.tsx`'s `/er` heading expectation is updated (see Notes); and the whole client suite passes.

## Files / areas

- `vetiflow.client/src/components/board/BoardViewSwitch.tsx` and `.module.scss` (new), `BoardViewSwitch.test.tsx` (new).
- `vetiflow.client/src/routes/ErBoardPage.tsx` and `ErBoardPage.test.tsx`.
- `vetiflow.client/src/app/App.test.tsx` (the `/er` expectation only).

## Verify

- The client suite and lint.
- `/check`: open `/er` at desktop and at 430 px width and compare with the screenshot: the switch sits under the heading, "ER board" is white and selected, "My patients" is muted and does not respond to clicks, and the hint text is on the same line.

## Notes for the AI

- The reference's selected tab is white with a soft shadow; use `var(--color-surface)` and the existing shadow token rather than new values.
- `App.test.tsx` expects the `/er` page's h1 to be "Northside Veterinary Emergency". That heading changes in fix 2, not here, so leave that expectation alone in this fix.
- Use a plain `role="tablist"` with `role="tab"` buttons, as `SignInPage` does for its method tabs.

## Open questions

None. The disabled My patients tab and the visible hint text follow the reference and the screenshot; say so at approval if you want the tab hidden instead.

## Result

- **Prepared:** branch `fix/board-view-switch`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-01, scope client (reused from 2026-11-01T18:55:37Z, fix/board-view-switch @ 2e5b7c6)
  - PASS  Workflow tests
  - NOT_APPLICABLE  Client install (installed lockfile is current)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
  - Not needed: server steps (no server files changed)
- **Check:** not run. No *Done when* needs the running app; the desktop and 430 px comparison with the screenshot has not been made in a browser.
- **Audit:** not needed.
- **Follow-ups added to build plan:** none. Fixes 2 (heading: "Northside Veterinary Emergency" eyebrow above "ER Command Center") and 3 (bell ping dot) follow as their own `/fix` items.
- **Deploy notes:** none.
- **Built differently from the spec:**
  - The app has no shadow token, so the selected tab uses a literal shadow, as `BoardStats` does; the track uses `--color-board-count-bg`, the closest existing tint.
  - `App.test.tsx` is unchanged: the `/er` heading does not change in this fix (the Notes), so its expectation still holds. Step 2's mention of updating it belongs to fix 2.
  - The reference hides the hint below 650 px; the hint stays visible at phone width, as the spec and the screenshot ask.
