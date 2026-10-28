# Fix: Smoother sign-in interactions

**Type:** Fix
**Status:** complete
**Branch:** `fix/sign-in-motion-polish`
**Audit:** recommended - application UI and keyboard focus presentation change; optional and not run automatically.

## Goal and authorization

The person asked Codex to inspect the deployed sign-in page and update its
CSS/SCSS and calling components to make interaction transitions smoother.
This is the approved scope of that direct implementation request.

## Scope

- Replace restarting panel entrance animations with reversible transitions,
  keeping the inactive panel inert and preserving the steady card layout.
- Use shared teal focus tokens on light surfaces, with immediate visible
  focus and eased decoration. Preserve contrasting rings on dark surfaces.
- Smooth hover, press, disabled, validation and loading feedback without
  changing authentication or adding artificial request delays.
- Ease the demo disclosure where supported, plus success and notice entrance.
  Preserve native behavior when newer CSS features are unavailable.
- Respect reduced motion, forced colors, keyboard operation and narrow layouts.
- Document the shared input-focus convention for future forms.

## Boundaries

No authentication/API/data changes, new dependencies, photo/layout redesign,
real SMS, secret access, audit, commit, push or deploy. The patient/owner API
work in the original checkout is unrelated and stays untouched.

## Steps

- [x] Refine styles and loading semantics using existing components and tokens.
- [x] Run `scripts/verify.ps1 -ClientOnly` and relevant browser checks.
- [x] Record actual evidence, limitations and the next workflow action.
- [x] Pass full Verify on the latest local main before preparing publication.

## Result and evidence (2026-10-27)

- The final `scripts/verify.ps1 -ReuseIfCurrent` ran in full on the updated
  main baseline and passed: workflow tests, server build and tests, client
  lint, production build and all 162 client tests in 23 files.
- Inspected the deployed sign-in page, then the final local production build
  at `http://127.0.0.1:5178/sign-in` in Chrome through computer use.
- On desktop, keyboard arrows switched tabs and Tab reached the active phone
  field with a visible teal ring.
- In the initial 240 ms browser check at 412 CSS pixels, the card's top,
  bottom and primary button top were
  identical before and after switching methods. The panel opacity progressed
  from 0 through 0.957 to 1; a reversal after 60 ms settled on the requested
  form, with the outgoing form inert.
- A failed phone submission focused the invalid field and showed an error
  border at 1 px, without changing border width.
- The native demo disclosure measured 115 px while opening, 173 px when open
  and 44 px when closed. Newer disclosure CSS is feature-gated; browsers
  without it retain native opening and closing.
- At 320 CSS pixels, normal and 200% root text had no horizontal page overflow
  or input/button extending beyond the viewport. The final simulated sending
  state at 200% kept its text inside the button. A decorative loading spinner
  was removed after this check found it overlapping enlarged text.
- With reduced motion emulated, panel, input, button and disclosure transitions
  computed to 0s. Normal motion was restored after checking.
- The emergency demo notice opened with its entrance animation and closed
  normally. With its trigger focused before opening, closing restored that
  focus. No real SMS, calling, directions or sign-in request was sent.
- Shared light-surface focus tokens and the future form styling convention
  are documented. Existing contrasting focus colors on dark surfaces remain.

## Limits and handoff

- Follow-up requested by the person: slow the Email/Phone content fade from
  240 ms to 420 ms with ease-in-out. The tab highlight and field movement
  keep their existing timing. Visibility waits for the full fade, while
  inactive forms become inert immediately. Reduced motion remains instant.
- Follow-up client verification passed all 162 tests, lint, build and workflow
  checks. An HTTP check of the local preview confirmed it serves the compiled
  420 ms ease-in-out opacity transition. The remaining browser behavior above
  was checked before the duration-only adjustment.

- Chrome desktop and emulated narrow layouts were checked. Other browser
  engines, physical phones, screen readers and forced-colors mode were not
  exercised. The success-screen entrance was compiled but not observed through
  a live authentication session.
- No audit was run. It remains optional. No commit, push or deploy was made.
- The original checkout's patient/owner work was not edited. These changes
  live in `.verify/worktrees/sign-in-motion` on `fix/sign-in-motion-polish`.
- The person asked to continue through publication preparation. Completion
  archives this verified spec and writes the commit/PR drafts. The next step
  after that is `/approve` in this fix worktree.

## Result

- **Prepared:** branch `fix/sign-in-motion-polish`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` on 2026-10-27, ran in full and then reused from 2026-10-28T02:32:16Z, fix/sign-in-motion-polish @ 863c12a.
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests (227 passed, none skipped)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests (162 passed)
- **Check:** Chrome desktop keyboard and emulated narrow layouts, card/button stability, interrupted fades, validation, 200% text, reduced motion and demo notice focus restoration. The requested 420 ms duration adjustment was built and confirmed in the stylesheet served by the local preview.
- **Audit:** recommended, not run because the person did not request it.
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none.
