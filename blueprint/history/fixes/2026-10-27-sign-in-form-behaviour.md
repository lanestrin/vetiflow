# Fix: Steady, accessible sign-in forms that always recover

**Type:** Fix
**Status:** complete
**Branch:** `fix/sign-in-form-behaviour`
**Audit:** recommended - changes how the sign-in requests and the access token are handled (client only; no endpoint or contract change)

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

This is part 1 of the sign-in review (2026-10-27): the card, its forms, their
motion and their error handling. Part 2 is a separate fix after this one
merges: the tablet and phone layout (blob-only background with the story over
it, no photo band, compact marketing on phones) and the emergency bar on
short screens, phone landscape, safe areas and the on-screen keyboard.

## The problem

On `/sign-in` (S.18a, S.19, S.20a-c and the tab-motion fix):

1. **A malformed sign-in response leaves the form stuck.**
   - In `vetiflow.client/src/services/authApi.ts`, `requestToken` calls
     `response.json()` and `readAccessToken` outside any `try`. A 200 with
     invalid JSON, or with no `accessToken`, rejects `signInByEmail` and
     `verifyPhoneSignIn`.
   - Both forms `await` those calls before their `try` blocks
     (`EmailSignInForm.tsx` `handleSubmit`, `PhoneSignInForm.tsx`
     `handleCodeSubmit`), so the button stays on "Signing in…" and disabled
     for good, with no message.
   - `getSignedInUser` returns whatever `/api/auth/me` sent, without checking
     its shape.
2. **The card and its button move when switching Email and Phone.** The
   panels' wrapper eases to each form's height, so the card's foot and the
   primary button change place on every switch.
3. **Validation feedback is incomplete.**
   - After a failed submit, focus stays on the button; the first invalid
     field is not focused.
   - An error stays on screen while the person corrects the field, until the
     next submit.
   - Errors and the "code is ready" message rely on text and colour only
     (the invalid field also gets a thicker border); there is no icon.
   - "Use a different number" leaves focus on a button that disappears.
4. **A request still running when the person switches method can change the
   flow.** Both forms stay mounted (hidden), so an email sign-in that
   finishes after switching to Phone still shows "You're all set", and a
   failure writes a message into the hidden form.
5. **Duplicate requests are possible.** The buttons disable only after React
   re-renders, so a fast double press or Enter can start two requests.
6. **Motion is uneven.** The panel slides in sideways; inputs, buttons and
   errors change with no transition; durations live in the page module only.

## The fix

1. **Recover from every failure** (`authApi.ts` and both forms).
   - `requestToken` reads the body inside a `try`; invalid JSON or a missing
     `accessToken` returns `{ ok: false, failure: "unavailable" }`, like a
     network error.
   - `getSignedInUser` checks the body has the `SignedInUser` fields it
     uses, and throws when it doesn't. `finishSignIn` already clears the
     token on any throw.
   - Each form runs its whole sequence (token request, then
     `finishSignIn`) in one `try`/`catch`/`finally`. Any failure shows
     `failureMessages.unavailable`, and `finally` always makes the form
     usable again.
   - No technical detail, token or credential ever reaches the screen or
     the console.
2. **One request at a time, and only for the visible form.**
   - Each form keeps its running request's `AbortController` in a ref. A
     submit, or "Send again", while one is running is ignored. This works
     before React re-renders, unlike the `disabled` button.
   - The `authApi` functions take an optional `AbortSignal` and pass it to
     `fetch`.
   - `SignInPage` passes `isActive` to each form. When a form stops being
     active it aborts its request. When the aborted call returns, the form
     drops the result silently: no message and no sign-in. It returns to
     idle with the typed values kept.
   - If the token had already arrived, the `/me` call is aborted too, and
     `finishSignIn` clears the token, so nothing is left half signed in.
3. **A steady card.**
   - Both panels share one grid cell, so the cell is as tall as the taller
     form. The inactive panel keeps `hidden`, but the CSS shows it with
     `visibility: hidden` so it holds its space. `inert` keeps it out of
     the tab order and the accessibility tree; `visibility: hidden` already
     hides it from screen readers.
   - Each form is a flex column with its primary button and status line at
     the foot of the cell, so switching tabs never moves the card's edges
     or the button.
   - Wrapped errors, larger text and longer wording make the cell grow. No
     fixed heights, and nothing is clipped. The phone's code step is
     taller, so the card grows once when it appears. That is a change of
     step, not of method.
   - `useMeasuredHeight` and the height easing are no longer needed. The
     hook and its test are deleted.
4. **Validation that guides** (extends each form's own `validate`; no new
   system).
   - Errors appear only after a submit. After that, a field that was invalid
     is checked again on each change, so its error clears (or updates) as
     the person fixes it. A field never gets an error before the first
     submit.
   - A failed submit focuses the first invalid field. Its error is
     announced through `aria-describedby`, which is kept.
   - The rules stay as they are: email required and shaped like an address,
     password required (no strength rules), a 10-digit US number, and a
     6-digit code.
   - Each field error and the error status line get a small error icon.
     The "ready" message gets a check icon. Icons are `aria-hidden`, and the
     words carry the meaning.
   - "Use a different number" moves focus to the phone field. The number
     stays filled in.
   - Values are kept when switching methods (both forms stay mounted; this
     is now tested).
   - The server stays authoritative: its failure codes and messages are
     unchanged.
5. **Consistent, quiet motion.**
   - `_tokens.scss` gets `--motion-fast: 150ms`, `--motion-base: 200ms` and
     `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`.
   - The tab highlight slides on `--motion-base`.
   - The newly shown panel fades in, rising 0.25rem.
   - Inputs ease their border colour, and the primary button its
     background, on `--motion-fast`. The button sinks 1px while pressed.
   - Field errors fade in on `--motion-fast`. No shaking and no bouncing.
   - Only named properties transition (never `all`), and outlines never
     do, so focus shows at once.
   - The loading, disabled, hover, pressed and focus states stay visually
     distinct.
   - `prefers-reduced-motion: reduce` turns all of these off. The scene's
     own reduced-motion handling (S.20c) is unchanged.

Must not break:
- The demo sign-in contracts (`/api/auth/email`, `/api/auth/phone/start`,
  `/api/auth/phone/verify`, `/api/auth/me`) and their failure messages.
- The tabs pattern and its keyboard behaviour.
- Focus moving to the code field on the code step, and to the heading on
  success.
- The session-ended notice, Help opening the demo accounts, and the
  emergency bar.
- The wide and narrow layouts from S.20a-c.
- Every existing sign-in test.

## Build steps

- [x] **Step 1 - failing tests for recovery** - in `authApi.test.ts` and
  `SignInPage.test.tsx`. *Done when:* these fail against current code:
  - **`authApi.test.ts`:**
    - "says unavailable when the token response is not JSON"
    - "says unavailable when the token response has no access token"
    - "rejects a signed-in user response without the expected fields"
  - **`SignInPage.test.tsx`:**
    - "recovers when the sign-in response is malformed": the form becomes
      usable again and shows the unavailable message.
- [x] **Step 2 - recovery and one-request-at-a-time** - `authApi.ts` (shape
  checks, optional signal), both forms (one `try`/`finally`, the ref
  guard, `isActive` abort), and `SignInPage.tsx` passing `isActive`.
  *Done when:* step 1's tests pass, along with these new ones in
  `SignInPage.test.tsx`:
  - "sends one request when sign-in is pressed twice", counted with an MSW
    handler.
  - "drops an email sign-in that finishes after switching to Phone": no
    success screen, and the email form is usable with its values when
    switched back.
  - The same for a pending phone code request.
- [x] **Step 3 - validation that guides** - both forms and
  `signInIcons.tsx` (error and check icons). *Done when:* these new tests
  in `SignInPage.test.tsx` pass:
  - "focuses the first invalid field after a failed submit" (email with
    both fields empty focuses Email; a bad number focuses Phone; a bad
    code focuses Code)
  - "shows no error before the first submit"
  - "clears a field's error as it is corrected"
  - "keeps typed values when switching methods"
  - "returns focus to the phone field after Use a different number"
- [x] **Step 4 - the steady card and shared motion** - `_tokens.scss`,
  `SignInPage.tsx` and its module, `SignInForm.module.scss`,
  `PrimaryButton.module.scss`; delete `useMeasuredHeight.ts` and its test.
  *Done when:*
  - The test "keeps only the chosen form reachable after switching back
    and forth" passes with `inert` added.
  - Client lint, build and all tests pass.
  - A real-time headless Chrome probe (CDP, see memory) measures the
    card's top, its bottom and the primary button's top. Each is within
    1px between Email and Phone at 1600, 1280 and 390 px wide, and at
    390 px with 200% root text size.
  - At 320 px wide there is no horizontal scroll and no clipped control
    or focus outline.
  - With reduced motion emulated, the computed `transition-duration` and
    `animation-name` on the highlight, panels, inputs and button are off.
  - The motion itself is for the person to watch.

## Verify

- **Client:** `authApi.test.ts`, `SignInPage.test.tsx` and the whole suite
  through `scripts/verify.ps1`.
- **Browser (headless Chrome, real time):**
  - Card and button positions at 1600, 1280, 390 and 320 px, and with 200%
    text.
  - Reduced motion.
  - Keyboard order: tabs, then the fields, then the button.
- **For the person to try:**
  - Switch Email and Phone and watch nothing below the tabs move.
  - Submit empty fields; focus lands on the first, and the errors clear as
    you type.
  - "Use a different number" puts focus back on the phone field.

## Build notes

- **Recovery:**
  - `authApi.ts` treats a success with invalid JSON or no `accessToken` as `unavailable`. It checks that `/api/auth/me` has a `name` and a known `experience`.
  - Every call takes an optional `AbortSignal`.
- **One request at a time:** the new `useSignInRequest(isActive)` hook guards with a ref, and its effect's clean-up cancels the request when the form stops being active or unmounts.
  - `run()` returns `done`, `failed` or `dropped`.
  - It checks for a cancel after the await, in one place, so neither form needs its own checks.
- **Messages:**
  - The new `FormMessages.tsx` holds `StatusMessage` (error, info or success tone, with an icon for error and success) and `FieldError` (with an icon).
  - The `FormMessage` type and `noMessage` live in `signInMessages.ts`, because lint allows only components in a component file.
  - The session-ended notice and the password-reset placeholder now read as information, not in error red.
- **Validation:**
  - Each form's rules are split per field. A field with an error is checked again on change.
  - A failed submit focuses the first invalid field.
  - "Use a different number" uses `flushSync`, then focuses the phone field.
- **Steady card:**
  - The panels share one grid cell, and the hidden one has `visibility: hidden` and `inert`.
  - The forms fill the cell, with `.actions` (button and status line) at the foot.
  - `useMeasuredHeight` and its test are deleted.
- **Phone hint:** in the first browser check, the phone number step showed an empty space where Email's password field sits. A hint now sits under the phone field, described by `aria-describedby`: "Demo mode: no text is sent. The next step shows the code to use." It fills part of that space; about 120 px stays empty above the button on wide screens, by design so the button holds its place.
- **Motion:**
  - `_tokens.scss` has `--motion-fast`, `--motion-base` and `--ease-out`.
  - The panel fades in, rising 0.25rem.
  - Inputs ease their border and box-shadow, and the button its background and transform; the button sinks 1px while pressed.
  - Errors and messages fade in.
  - The invalid border is now 1px plus an inset shadow, so it doesn't shift the layout.
  - Reduced motion turns all of this off.
- **Tests:**
  - Step 1's 4 tests failed first.
  - Against the old code, 13 of the new or changed tests fail. "No error before the first submit" and "keeps typed values" passed already, because they guard existing behaviour.
- **Browser (headless Chrome over CDP, real time):**
  - Card top, card bottom and button top were identical for Email, Phone and Email again at all of these:

    | Size | Card top | Card bottom | Button top |
    | --- | --- | --- | --- |
    | 1600×900 | 65 | 829 | 499 |
    | 1280×800 | 789 | 1512 | 1200 |
    | 390×844 | 542 | 1306 | 946 |
    | 320×640 | 557 | 1339 | 962 |
    | 390, 200% root text | 1422 | 3651 | 2516 |

  - No horizontal scroll and no control past the right edge at any size.
  - A failed empty submit focused the email field.
  - With reduced motion emulated, the highlight, panel, input and button all computed `0s` and no animation. Normally they computed 0.2s, `panel-in`, 0.15s and 0.15s.
- **Not checked in a browser:** keyboard order. It is covered by the tests (inert panel, tabs pattern) and not driven by key presses in Chrome. The motion itself is for the person to watch.
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` ran in full: workflow tests, server build, server tests, client lint, client build and client tests all PASS (client: 22 files, 157 tests).

## Result

- **Prepared:** branch `fix/sign-in-form-behaviour`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T19:32:00Z, fix/sign-in-form-behaviour @ 1f2e24c)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check (headless Chrome over CDP, real time, against `vite preview`):** see Build notes.
  - The card's top and bottom and the button's top were identical between Email and Phone at 1600, 1280, 390 and 320 px wide, and at 200% text.
  - No horizontal scroll and no control past the right edge.
  - A failed empty submit focused the email field.
  - Reduced motion turned off every transition and animation on the highlight, panel, input and button.
- **Audit:** recommended, not run (the person did not ask for one).
- **Follow-ups added to build plan:** none. Part 2 (tablet and phone layout, emergency bar on short screens) is the next `/fix`.
- **Deploy notes:** none.
