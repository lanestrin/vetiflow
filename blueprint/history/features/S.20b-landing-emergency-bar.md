# Feature: Emergency bar on the sign-in landing page

**From build-plan:** feature S.20b
**Status:** complete
**Branch:** `feature/landing-emergency-bar`
**Audit:** not needed - a static bar and a notice dialog; no endpoint, data, setting or sign-in change

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

`/sign-in` ends with the designer's "Need emergency care?" bar, so a worried
pet parent sees at once where to turn. VetiFlow is a demo with no real
hospital behind it, so **Call Now** and **View Directions** never dial or open
a map. They open a clear demo notice that points to a local emergency vet
instead (decided 2026-10-27: "Show it with a demo notice").

## Design reference

- `blueprint/reference/landing-page/desktop-preview.png` (1672×941), the
  bar across the bottom:
  - dark green `#193C39`
  - a crimson circle with a white phone, "Need emergency care?", a thin
    divider, then "For life-threatening emergencies, call your hospital
    directly."
  - on the right, a crimson **Call Now →** pill and an outlined white **View
    Directions** pill with a map pin and an "opens elsewhere" mark
- `blueprint/reference/landing-page/index.html` and `app.js`:
  - the markup (`aside` with `aria-label="Emergency veterinary care"`)
  - the designer's own rule: without a configured number and address, the
    buttons show a preview message instead of dialling made-up contacts

## In scope

- **`EmergencyBar`** (new), an `aside` landmark named "Emergency veterinary
  care":
  - The phone circle (decorative), the heading "Need emergency care?" (`h2`),
    and the line "For life-threatening emergencies, call your hospital
    directly."
  - **Call Now →**: a button in crimson `#D9383A` with white text.
  - **View Directions**: a button outlined in white, with its pin icon.
    There's no "opens elsewhere" mark, because in the demo it doesn't open
    anything.
  - Both are real buttons (not links), at least 44 px tall, with visible
    focus.
- **`DemoNoticeDialog`** (new): a native `<dialog>` opened with
  `showModal()`, so the browser keeps focus inside it, closes it on Escape
  and returns focus to the button that opened it.
  - Heading: "Demo: no hospital is set up".
  - Call Now: "This demo isn't connected to a real hospital, so Call Now
    can't dial a number. If your pet needs care right now, call your local
    emergency vet."
  - View Directions: the same, with "View Directions can't open a map".
  - One **OK** button closes it. A click on the backdrop closes it too.
- **Placement on the page:**
  - **85rem and wider:** the bar runs full width at the very bottom of the
    page, under the story and the card, as in the preview. The page stays at
    least one screen tall, and the bar sits over the art's faded foot.
  - **Narrower:** the bar comes last, after the benefits and the tagline,
    with the text above the two buttons. The buttons sit side by side and
    stack when there is no room, at full width.
- **Colours on this page only:** the bar's green `#193C39`, and the shared
  crimson already used by the logo.
  - White on `#193C39` is about 12:1.
  - White on `#D9383A` is about 4.6:1, which passes AA for the button text.
  - The outline is white on green.

## Out of scope

- A real phone number or address, and any setting to hold them. Without a
  real hospital there is nothing true to put there. When there is, a later
  item can add settings and swap the notice for `tel:` and a maps link.
- The bar on any other page.
- The rest of the designer's preview that differs from the merged page: the
  green Sign in button and the pre-filled email. S.20a decided against both.

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - the bar and the notice** - `EmergencyBar` and
  `DemoNoticeDialog` with their styles. *Done when:*
  `EmergencyBar.test.tsx` (new) checks:
  - The landmark "Emergency veterinary care" has its heading and line.
  - **Call Now** opens a dialog named "Demo: no hospital is set up" that
    says it can't dial; **OK** closes it.
  - **View Directions** opens the same dialog saying it can't open a map.
  - No link or `tel:` is anywhere in the bar.
- [x] **Step 2 - on the page** - add the bar to `SignInPage` for wide and
  narrow layouts. *Done when:*
  - `SignInPage.test.tsx` finds the emergency landmark, and every existing
    sign-in test still passes.
  - Client lint, build and all tests pass.
  - Screenshots at 2560, 1920, 1600, 1366, 1024, 768, 390 and 320 px show:
    - the bar full width at the bottom
    - the buttons in reach
    - no sideways scroll

## Files / areas

- `vetiflow.client/src/components/auth/EmergencyBar.tsx`, its module and
  test (new)
- `vetiflow.client/src/components/auth/DemoNoticeDialog.tsx` and its module
  (new)
- `vetiflow.client/src/components/auth/signInIcons.tsx` (a map-pin icon; the
  phone icon exists)
- `vetiflow.client/src/routes/SignInPage.tsx`, `SignInPage.module.scss`,
  `SignInPage.test.tsx`

## Data / contracts

- None.

## Security

- **No new surface.** No number, address, link or outbound call; the buttons
  only open a local dialog.
- **No invented contact details,** so nobody can be sent to a hospital that
  doesn't exist (the designer's own warning).

## Testing

- Client:
  - `EmergencyBar.test.tsx` (new).
  - `SignInPage.test.tsx`: the landmark, and all existing tests.
  - jsdom has no `showModal`, so the test stubs it and `close` on
    `HTMLDialogElement.prototype` when missing. That's in the test file, not
    the app.
- `/check`:
  - The screenshots above, with the dialog open once.
  - The browser steps are yours if no browser tool is available:
    - Tab to Call Now, press Enter, and check focus is in the dialog.
    - Escape closes it, and focus is back on Call Now.
    - Repeat for View Directions.

## Notes for the AI

- Reuse `PhoneIcon` from `signInIcons.tsx`. Add `MapPinIcon` beside it.
- Keep the dialog's wording in the component, not the bar. One dialog serves
  both buttons, with a prop for which action it explains.
- On wide screens, add the bar as a final full-width grid row
  (`"emergency emergency emergency"`), bleeding past the shell's padding, so
  the existing S.20a/S.20c layout maths are untouched.

## Build notes

- **The bar sticks to the bottom of the window from 85rem up:**
  - **Why:** the card makes the page taller than the screen. At 1600×900 the
    plain footer was almost entirely below the fold, while the design shows
    it at the bottom of the screen.
  - **What it needed:** the shell's `overflow: hidden` became
    `overflow: clip`, which clips the same way without making the shell a
    scroll box, which would stop sticking.
  - **Narrow screens:** the bar is not sticky there, because on a phone it
    would cover too much of the form.
- **Focus is never hidden under the bar:** the card's controls get
  `scroll-margin-block-end: 7.5rem`, so when one gets keyboard focus the
  browser scrolls it clear of the bar (WCAG 2.2 "Focus not obscured").
- **The dialog** relies on the browser to return focus to the button that
  opened it when it closes.
- **Tests:** `EmergencyBar.test.tsx` 4 tests, plus a check in
  `SignInPage.test.tsx` that the page ends with the emergency landmark; 142
  client tests in all.
- **Screenshots:** headless Chrome against `vite preview` at 2560×1080,
  1600×900, 1366×768 and 1024×768, plus 390 and 320 px through an iframe
  scrolled to the bottom, and 1600×900 with Call Now clicked.
  - The bar is pinned on wide screens and last on phones, with full-width
    buttons and no sideways scroll.
  - The notice opens over a green backdrop with focus on OK.
- **Left for the person:** the keyboard steps (Tab to Call Now, Enter,
  Escape, focus back on the button).

## Result

- **Prepared:** branch `feature/landing-emergency-bar`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T18:07:37Z, feature/landing-emergency-bar @ 670c4b6)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:**
  - Step 1: `EmergencyBar` tests 4/4, with types and lint clean.
  - Step 2: client 142/142, with lint and build clean.
- **Check (headless Chrome against `vite preview`):**
  - At 2560×1080, 1600×900, 1366×768 and 1024×768 the bar is visible.
  - At 390 and 320 px, scrolled to the bottom, the bar comes last with full-width buttons and no sideways scroll.
  - At 1600×900 with Call Now clicked, the notice opens with focus on OK.
  - The first round showed the bar below the fold at 1600×900. It was made sticky on wide screens, with a scroll margin so focus is never hidden under it.
  - The keyboard steps were not run (no interactive browser).
- **Audit:** not needed (a static bar and a local dialog).
- **Follow-ups added to build plan:** none. A real hospital number and address, when there is one, would be a new item.
- **Deploy notes:** none.
