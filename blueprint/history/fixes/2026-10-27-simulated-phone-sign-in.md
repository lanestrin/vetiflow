# Fix: Simulated demo phone sign-in with the code field in view

**Type:** Fix
**Status:** complete
**Branch:** `fix/simulated-phone-sign-in`
**Audit:** recommended - changes the sign-in flow (build plan phase S) and removes the `/api/auth/phone/start` endpoint

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

On `/sign-in`, Phone tab (`vetiflow.client/src/components/auth/PhoneSignInForm.tsx`, build plan S.19):

1. **It can stick on "Sendingâ€¦".** Step one waits on
   `POST /api/auth/phone/start` (`AuthController.StartPhoneSignIn`,
   `vetiflow.Server/Controllers/AuthController.cs:70`) before the code step
   appears. The person saw the button stay on "Sendingâ€¦" for 312-555-0102. I
   couldn't reproduce it with the API stopped: the proxy answers 502 at once
   and the form shows "Sign-in isn't available right now". So the hang happens
   while the API is up and slow to answer, for example while it waits on the
   database. Either way, a demo with nothing to send has no reason to wait on
   the network here.
2. **The number step looks unfinished.** Both panels share one grid cell, so
   the card doesn't jump when the tab changes (`SignInPage.module.scss`
   `.panels`), and `.actions` pushes the button to the foot. The number step
   has one field and a note, against the Email tab's two fields, which leaves a
   large empty gap above the button.
3. **The code field only exists after a round trip.** The person wants the
   verification step simulated in the browser, with a field for the demo code.

Reproduce: run the app, choose Phone, enter 312-555-0102 and press "Text me a
sign-in code".

## The fix

Simulate both steps in the browser, and show both fields from the start so the
phone form matches the Email tab's shape.

**Layout (one form, no separate code step):**

- **Mobile phone number** field. Its note is unchanged: "Demo mode: no text is
  sent. The next step shows the code to use."
- **Verification code** field, always shown. It is `disabled` until a code is
  "sent", with the placeholder "Send a code first". Once sent, it is enabled,
  gets focus and shows the placeholder "6-digit code". Its note says "Demo mode:
  no text is sent. Use code **123456**." After sending, a "Send again" link sits
  at the right of its label row, like "Forgot password?" on the email form.
- **Primary button:** "Text me a sign-in code â†’" before sending; "Verify and
  sign in" after.
- Two fields and a button fill the panel as the email form does, so the gap
  goes away. The card still doesn't move between tabs.
- Changing the phone number after sending returns to "not sent": the code
  clears and the code field is disabled again. That replaces the "Use a
  different number" link, which is removed.

**Simulated send (step one):**

- No request at all. The format check (`phoneError`) is unchanged. The button
  shows "Sendingâ€¦" for 800 ms, then the code field enables and gets focus, and
  the status line shows "Demo verification is ready. No text was sent." as now.
- "Send again" repeats the same 800 ms simulation and keeps the code field
  enabled.

**Simulated verify (step two):**

- The code format check (`codeError`) is unchanged. The button shows "Signing
  inâ€¦".
- A code other than `123456` waits 600 ms, then shows the existing `wrongCode`
  message, with no request.
- `123456` waits 600 ms, then calls `POST /api/auth/phone/verify` once, then
  `finishSignIn`, as today. The server still decides `unknownPhone`,
  `inactiveAccount` and `phoneSignInOff`, and those messages show here. A
  number with the right format that isn't a demo account is now rejected at
  this step instead of at sending.
- The client's `123456` is a named constant beside the note that already
  shows it. The server still checks the code (`DemoSignIn.Code`); the client
  check only spares a request.

**Waiting and cancelling:**

- Both simulated waits run through `useSignInRequest.run`, with a small
  `delay(ms, signal)` that rejects when the signal aborts. A double press,
  switching to the Email tab, and unmounting all behave as they do for real
  requests: one at a time, dropped when cancelled.
- The waits stay under reduced motion. They are pauses, not animation.

**Remove the unused step-one API (no backward compatibility needed):**

- Server: `AuthController.StartPhoneSignIn`,
  `Contracts/Auth/PhoneStartRequest.cs`, and the `StartPhone_*` tests and
  `StartPhoneAsync` helper in `AuthEndpointTests.cs`.
  `PhoneSignIn_WhenDemoSignInIsOff_ReturnsPhoneSignInOff` keeps checking
  verify only.
- Client: `startPhoneSignIn`, `PhoneStartResult`, and their tests in
  `authApi.test.ts`.

**It must not break:**

- Email sign-in, the tabs, the steady card height, and the inert hidden panel.
- `/api/auth/phone/verify`, which is unchanged: the code stays checked on the
  server, and the setting that turns phone sign-in off still blocks it.
- Focus on the first invalid field, the field errors, and the status line
  (`role="status"`).
- The focus styles from the previous fix.
- No phone number or code in logs or error responses. No new logging is
  added.

## Build steps

- [x] **Step 1 - failing tests** - rewrite the `phone` block in
  `vetiflow.client/src/routes/SignInPage.test.tsx` for the new flow. Use fake
  timers (`vi.useFakeTimers({ shouldAdvanceTime: true })`) or `findBy` with
  enough timeout for the waits. Tests:
  - shows both fields; the code field is disabled before sending;
  - asks for a 10-digit number before sending, and makes no request;
  - shows "Sendingâ€¦", then enables and focuses the code field and says no
    text was sent, with no request to the API;
  - says to use 123456 when the code is wrong, with no request;
  - signs in with 123456: one request to `/phone/verify`, then the portal;
  - shows the server's message for `unknownPhone` and `phoneSignInOff` at
    verify;
  - changing the number after sending disables and clears the code field;
  - Send again keeps the code field enabled and repeats the ready message;
  - focuses the field that needs fixing;
  - drops a send or a code check that finishes after switching to Email;
  - one request when Verify is pressed twice.

  *Done when:* the new tests fail against the current form, and the email tests
  still pass (`npm run test -- --run SignInPage`).
- [x] **Step 2 - simulated phone form** - rewrite `PhoneSignInForm.tsx` as
  above. Add `delay` beside `useSignInRequest`. Remove `startPhoneSignIn` and
  `PhoneStartResult` from `authApi.ts`, and their tests. Add a `labelRow` link
  for Send again. No new styles beyond what `SignInForm.module.scss` already
  has; disabled fields may need a `:disabled` look (muted background, the
  resting border), added there. *Done when:* `npm run test -- --run` passes and
  `npm run lint` is clean.
- [x] **Step 3 - remove `/phone/start`** - delete the endpoint, the
  `PhoneStartRequest` contract and their tests; keep the
  phone-sign-in-off test on verify. *Done when:*
  `dotnet test --project vetiflow.Server.Tests --filter-class "*AuthEndpointTests"`
  passes, and `POST /api/auth/phone/start` returns 404 in the running app.

## Verify

- `scripts/verify.ps1`: all steps PASS.
- `/check` on `/sign-in`, Phone tab, at desktop and 320px width, with the API
  running:
  - Both fields show and there is no large gap above the button. The card is
    the same height on both tabs.
  - Sending shows "Sendingâ€¦" for about 800 ms, then the code field is enabled
    and focused. The network log shows no request.
  - A wrong code shows the "use 123456" message with no request. `123456` with
    312-555-0102 signs in to the pet-parent portal, and with 312-555-0101 to
    the team board.
  - A well-formed number that isn't a demo account shows the "couldn't match
    that demo phone" message at verify.
  - Changing the number after sending disables the code field again.
  - Screenshots before and after sending.

## Open questions

- None blocking. Possible follow-up, not in this fix: a client timeout on the
  remaining real requests (`/phone/verify`, email sign-in), so a slow API
  can't hold "Signing inâ€¦" for long. That would be its own `/fix`.

## Result

- **Prepared:** branch `fix/simulated-phone-sign-in`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T22:35:47Z, fix/simulated-phone-sign-in @ 03f09ab; the run itself was fresh during `/ready`)
  - PASS Workflow tests
  - PASS Server build
  - PASS Server tests
  - PASS Client lint
  - PASS Client build
  - PASS Client tests
- **Check:** real-time headless Chrome over CDP, with the real API on a local database, at 1280x900 and 320x640:
  - Both fields show from the start. The code field is grey and off ("Send a code first"). The button sits 20 px under the last note, and the button and card stay in the same place on both tabs.
  - Sending showed "Sending…" at 150 ms. By 1050 ms the code field was on and focused, with "Demo verification is ready". No API request was made.
  - A wrong code (654321) gave "Use 123456 for this demo." with no request.
  - Changing the number after sending turned the code field off and cleared it.
  - 312-555-0199 with 123456 gave the "couldn't match that demo phone" message from one `phone/verify` call.
  - 123456 signed 312-555-0102 in as the pet parent and 312-555-0101 as a team member, each with one `phone/verify` and one `/me`.
  - `POST /api/auth/phone/start` returned 404.
  - Screenshots before and after sending.
  - Trade-off seen: the phone form is now the taller panel, so the Email tab shows a 55 px (desktop) / 92 px (320 px) gap above its button.
- **Audit:** recommended, not run (sign-in flow change and endpoint removal; optional)
- **Follow-ups added to build plan:** none. Possible fixes: a client timeout for the remaining real sign-in requests; shorten the phone note now that the code note sits right below it.
- **Deploy notes:** none (no migration or setting; `POST /api/auth/phone/start` no longer exists)
