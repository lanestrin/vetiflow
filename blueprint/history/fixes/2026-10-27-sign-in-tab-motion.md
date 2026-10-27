# Fix: Smooth motion when switching between Email and Phone

**Type:** Fix
**Status:** complete
**Branch:** `fix/sign-in-tab-motion`
**Audit:** not needed - motion on existing sign-in controls; no data, endpoint or sign-in rule change

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

Reported with a screenshot on 2026-10-27, on `/sign-in` (S.20a/S.20b):

1. **The Email / Phone choice jumps.** Each tab draws its own selected
   background (`.tab[aria-selected="true"]` in
   `vetiflow.client/src/routes/SignInPage.module.scss`), so the highlight
   blinks from one side to the other instead of moving.
2. **The card snaps to a new height.**
   - The email form has two fields and the phone form one, so switching tabs
     makes the card grow or shrink in one frame.
   - The same happens when the phone form moves to its code step, and when
     a field error or a message appears.

## The fix

1. **One sliding highlight.**
   - The tab list gets a single highlight element: the mint pill with its
     outline, behind the two tabs, half the list wide.
   - It slides to the selected tab (`transform`, about 250 ms, ease-out).
   - The tabs themselves become transparent. The selected tab keeps its bold
     navy text, so the choice never relies on colour or motion alone.
   - The tabs stay real `role="tab"` buttons, with the same keyboard
     behaviour (arrows, Home, End).
2. **Height that eases.**
   - The two tab panels sit in a wrapper whose height eases (about 250 ms)
     to the measured height of the visible panel.
   - A small `useMeasuredHeight` hook watches that panel with a
     `ResizeObserver`, so the code step, field errors and messages ease too.
   - The newly shown panel fades in, sliding a few pixels from the side of
     the tab that was chosen.
   - The wrapper clips overflow while it moves. A little padding, offset by
     a matching negative margin, keeps the 3 px focus outlines from being
     cut off.
3. **Reduced motion:** with `prefers-reduced-motion: reduce` the highlight
   and height change at once, with no slide or fade.

Must not break:
- the tabs pattern and its tests
- `hidden` on the inactive panel, so screen readers and Tab only reach the
  visible form
- focus moving to the code field on the phone's code step
- the session-ended notice
- every existing sign-in test

## Build steps

- [x] **Step 1 - the measuring hook** - `useMeasuredHeight(ref)` in
  `components/auth/`. It returns the element's height and updates on resize,
  and returns `undefined` without `ResizeObserver` (tests, old browsers) so
  the wrapper falls back to its natural height. *Done when:*
  `useMeasuredHeight.test.tsx` (new), with a stubbed `ResizeObserver`:
  - reports the observed height
  - updates when it changes
  - disconnects on unmount
  - returns `undefined` with no `ResizeObserver`
- [x] **Step 2 - the sliding highlight and the easing panels** - in
  `SignInPage.tsx` and its module. *Done when:*
  - Every `SignInPage.test.tsx` test passes unchanged, and a new one checks
    the inactive panel is still `hidden` after switching to Phone and back.
  - Client lint, build and all tests pass.
  - Screenshots at 1600 and 390 px show the highlight under Email, then
    under Phone, with no layout jump at rest.
  - The motion itself is for the person to watch: switch tabs, then do the
    phone code step.

## Verify

- Client: `useMeasuredHeight.test.tsx`, `SignInPage.test.tsx`, and all
  tests.
- In the app (`npm run dev`, `/sign-in`):
  - Click Email and Phone, and use the arrow keys, to see the highlight
    slide and the card ease.
  - Enter a phone number to see the code step ease in.
  - Turn Windows animation effects off and reload: everything changes at
    once.

## Build notes

- **`useMeasuredHeight` keeps the last height when the watched element
  changes,** until the new one is measured. Otherwise the wrapper would snap
  to the new form's natural height for a frame before easing.
  - Lint (`react-hooks/set-state-in-effect`) rules out resetting state
    inside the effect, so the only setter is the ResizeObserver callback.
- **The wrapper's measured height applies only once it is set.**
  `SignInPage` sets `--panel-height`, and the CSS uses it only when the
  `style` attribute holds it. Before the first measurement, or without
  `ResizeObserver`, the forms keep their natural height.
- **The new test uses role queries** to show the inactive panel is out of
  reach. A hidden panel leaves the accessibility tree, so `queryByRole`
  doesn't find it.
- **Checked in real time:** Chrome's virtual clock doesn't deliver
  ResizeObserver or animation frames, so a small DevTools-protocol script
  (scratchpad only, not committed) drove headless Chrome in real time.
  - After clicking Phone, the wrapper eased 293 → 238 → 190 → 185 px and
    the highlight slid 0 → 55 → 179 → 195 px across. Both are back at
    293 px and 0 after Email.
  - Screenshots on Phone at rest show the card fitting the shorter form.
  - The same frames show the S.20c blob outlines moving between screenshots.
- **Tests:** `useMeasuredHeight.test.tsx` 3 tests, plus one in
  `SignInPage.test.tsx`; 146 client tests in all.

## Result

- **Prepared:** branch `fix/sign-in-tab-motion`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T18:43:15Z, fix/sign-in-tab-motion @ 194cf5f)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:**
  - Step 1: `useMeasuredHeight` tests 3/3. The first version reset state inside the effect and failed lint; it was rewritten.
  - Step 2: client 146/146, with lint and build clean. The new page test first used `getElementById` and failed lint; it was rewritten with role queries.
- **Check (headless Chrome against `vite preview`):**
  - Virtual-time screenshots showed the highlight under Email and then under Phone. They also showed a stuck height, which turned out to be virtual time not delivering ResizeObserver.
  - A real-time DevTools-protocol run sampled the wrapper at 293 → 238 → 190 → 185 px and the highlight at 0 → 55 → 179 → 195 px after clicking Phone, and both returned after Email.
  - A real-time screenshot on Phone shows the card fitting the shorter form.
  - Reduced motion was not exercised in the browser.
- **Audit:** not needed (motion only).
- **Deploy notes:** none.
