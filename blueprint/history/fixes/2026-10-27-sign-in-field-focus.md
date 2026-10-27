# Fix: Teal, steady focus on the sign-in fields

**Type:** Fix
**Status:** complete
**Branch:** `fix/sign-in-field-focus`
**Audit:** recommended - changes sign-in UI (build plan phase S) and how keyboard focus is shown on every sign-in field; styles only, no behaviour or contract change

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

On `/sign-in`, the four text fields (email and password in
`EmailSignInForm.tsx`, phone number and verification code in
`PhoneSignInForm.tsx`) all use `.input` in
`vetiflow.client/src/components/auth/SignInForm.module.scss`. On focus:

1. **The ring is off-brand.** `.input:focus-visible` draws
   `outline: 3px solid var(--color-focus)`, and `--color-focus` is `#2563eb`
   (`styles/_tokens.scss:28`), a bright blue that matches nothing else on the
   teal care brand.
2. **Nothing eases in.** `.input` already transitions `border-color` and
   `box-shadow`, but focus changes neither. Only the outline appears, all at
   once, with no softer edge.
3. **An invalid field loses its error look when focused.** `[aria-invalid]`
   gives a red border and a red inset edge. Focus adds the blue ring on top, so a
   focused invalid field reads as blue rather than as an error.

Reproduce: run the app, open `/sign-in`, press Tab into the email field, then
submit an empty form and Tab back into the field that has the error.

## The fix

Restyle `.input` focus in `SignInForm.module.scss` only. The one shared class
gives all four fields the same treatment.

- **Immediate indicator (not transitioned):** on `:focus-visible`,
  `outline: 2px solid var(--color-care-teal)` (`#126b65`, about 6.3:1 against
  the white field and card) with `outline-offset: 2px`. It is thinner than
  today's 3px ring and takes up no more room. `outline` stays out of the
  `transition` list, as the existing comment says, so keyboard focus shows on
  the first frame.
- **Eased decoration (`var(--motion-fast)`, 150 ms, `var(--ease-out)`):**
  - `border-color` changes to the teal.
  - A soft halo, `box-shadow: 0 0 0 4px` of the teal at about 15%
    (`color-mix(in srgb, var(--color-care-teal) 15%, transparent)`), fills the
    2px gap under the outline. It is a tint, not a glow: no blur and no larger
    spread.
- **No movement:** the border stays `1px`. The outline and the box-shadow sit
  outside the layout box, so the field's size and the text position do not
  change on focus.
- **Error stays an error:** `[aria-invalid="true"]:focus-visible` keeps the red
  border and the inset red edge, and turns the outline and the halo red
  (`$error`, `#a3392d`, about 6.6:1 against white). The invalid rules declare
  the shadows as one list, `inset` edge first and outer halo second, with the
  halo at `0` spread when not focused. The two lists then interpolate instead of
  jumping.
- **Hover:** the focus rule comes after `:hover`, so hovering a focused field
  keeps the teal border.
- **Reduced motion:** the existing
  `@media (prefers-reduced-motion: reduce) { .input { transition: none } }`
  already covers this. Keep it and confirm it.

It must not break the following:

- `--color-focus` is unchanged. Buttons, links, the dialog, the session bar and
  `SignInPage` controls keep their rings. Some of them sit on dark navy, where
  teal would fail contrast.
- The show-password button (`.revealButton`) keeps its own ring.
- Hover, placeholder and error-text styles stay as they are, and so do the
  3:1 resting border (`#7a8b8e`) and the form's layout.

## Build steps

- [x] **Step 1 - restyle field focus** - update `.input` in
  `SignInForm.module.scss` as above (teal outline, eased teal border and halo,
  red variant for `[aria-invalid="true"]`, reduced motion confirmed). CSS has no
  logic a jsdom test can observe, so no new Vitest test is added; the existing
  `EmailSignInForm`/`PhoneSignInForm` tests must keep passing. *Done when:*
  `scripts/verify.ps1` passes and `/check` observes the points under Verify.

## Verify

- `scripts/verify.ps1`: client lint, build and tests stay green.
- `/check` in headless Chrome on `/sign-in` at desktop and 320px width, for the
  email, password, phone and verification-code fields:
  - After Tab focus, the computed `outline` is `2px solid rgb(18, 107, 101)` on
    the first frame, and `border-color` and `box-shadow` reach teal and the
    halo after about 150 ms. Use a real-time CDP script, because virtual time
    hides transitions.
  - `getBoundingClientRect()` of the field and `border-width` are the same
    before and after focus.
  - With a field error showing, the focused field's outline, border and halo are
    red, not teal.
  - With `prefers-reduced-motion: reduce` emulated, the computed
    `transition-duration` is `0s` and the focus styles apply at once.
  - Screenshots of a focused field and of a focused invalid field, to confirm
    the halo looks subtle.

## Result

- **Prepared:** branch `fix/sign-in-field-focus`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T22:00:27Z, fix/sign-in-field-focus @ 0347f1c; the run itself was fresh during `/ready`)
  - PASS Workflow tests
  - PASS Server build
  - PASS Server tests
  - PASS Client lint
  - PASS Client build
  - PASS Client tests
- **Check:** headless Chrome over CDP, in real time, on `/sign-in` at 1280x900 and 320x640, with and without reduced motion, for the email, password, phone and verification-code fields. Every field showed `2px solid rgb(18, 107, 101)` on the first frame after keyboard focus. The border and halo were part-way at 60 ms and settled by 360 ms (150 ms transition). Size (509x48 / 248x48) and the 1px border did not change. The invalid email field focused red (outline, border, inset edge, halo) with the halo easing in. Reduced motion gave `transition: none 0s` with the styles applied at once. Screenshots confirmed a thin ring and a faint tint, with no glow. Not checked: a screen reader or a real touch device; neither is affected by a style-only change.
- **Audit:** recommended, not run (sign-in focus styles; optional)
- **Follow-ups added to build plan:** none
- **Deploy notes:** none
