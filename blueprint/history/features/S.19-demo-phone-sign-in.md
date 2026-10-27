# Feature: Demo phone sign-in

**From build-plan:** feature S.19
**Status:** complete
**Branch:** `feature/demo-phone-sign-in`
**Audit:** recommended - adds a second way to get a session token, with a fixed code behind a setting (phase S, authentication)

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

Both demo accounts can sign in with a mobile number and the fixed demo code
`123456`, as in the login mockup's Phone tab. No text is ever sent and no
SMS service is called, and the code works only where `DemoSignIn:Enabled` is
on (project plan section 10, acceptance criteria 1, 2 and 5).

## Design reference

- `blueprint/reference/vetiflow-login-mock.html`, the phone form:
  - "Mobile phone number" with the placeholder "(555) 555-0123", then "Text
    me a sign-in code".
  - The code step: "Verification code", "Demo mode: no text is sent. Use code
    123456." and "Verify and sign in".
  - The messages "Demo verification is ready. No text was sent.", "We
    couldn't match that demo phone…" and "Use 123456 for this demo."

## In scope

- **Server** (`AuthController`; the fixed code lives in one constant):
  - `POST /api/auth/phone/start` with `{ phoneNumber }`:
    - The number is normalized to `+1` and 10 digits. "312-555-0101",
      "(312) 555-0101", "3125550101" and "+1 312 555 0101" are all
      accepted.
    - A number that doesn't make 10 US digits gets a `400` validation
      problem.
    - When an active account has that number, the answer is `200 {}`.
      Nothing is sent and nothing is stored.
    - Otherwise `401` with `code` `unknownPhone` or `inactiveAccount`.
  - `POST /api/auth/phone/verify` with `{ phoneNumber, code }`:
    - The code must be 6 digits, or the answer is `400`.
    - The same account checks run, then a code other than `123456` gets
      `401` `wrongCode`.
    - Success returns the same token response as email sign-in, with the
      same claims, built by the same code.
  - Both answer `403` with `code` `phoneSignInOff` unless
    `DemoSignIn:Enabled` is `true`.
  - The setting is on in `appsettings.Development.json` and in the test host,
    and off by default everywhere else.
- **Client:**
  - `authApi.startPhoneSignIn` and `verifyPhoneSignIn`, with the new failure
    codes.
  - A shared `finishSignIn(token)` that saves the token and loads who is
    signed in. Email sign-in uses it too, so both paths end the same way.
- **`PhoneSignInForm`** replaces the "coming next" panel:
  - **Number step.** "Mobile phone number" and "Text me a sign-in code".
    - Field error: "Enter a 10-digit mobile number like 312-555-0101."
    - While sending, the button reads "Sending…".
  - **Code step:**
    - The status line says "Demo verification is ready. No text was sent."
    - Then "Verification code" (numeric, one-time-code autocomplete, 6
      digits), the "Demo mode: no text is sent. Use code 123456." note, and
      "Verify and sign in".
    - Field error: "Enter the 6-digit code."
    - "Use a different number" goes back to the number step.
    - "Send again" calls start again and repeats the ready message.
    - Focus moves to the code field.
  - **Messages:**
    - `unknownPhone`: "We couldn't match that demo phone. Try one of the
      sample numbers below."
    - `wrongCode`: "Use 123456 for this demo."
    - `inactiveAccount`: as for email.
    - `phoneSignInOff`: "Phone sign-in is turned off for this demo. Use email
      instead."
    - `unavailable`: as for email.
  - **Success:** the same "You're all set" panel as email.
- **"Try the demo" panel:** add the phones (312-555-0101, 312-555-0102) and
  the code 123456.

## Out of scope

- Any SMS provider, real codes, code expiry or attempt limits (rate limiting
  is S.9; production phone sign-in needs a paid provider, project plan
  section 10).
- Storing anything between start and verify: the demo code is fixed, so
  verify checks it directly.
- Changing the phone format rules in the database (S.16 already stores `+1`
  and 10 digits).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - phone endpoints** - normalizing, the two endpoints, the
  setting, the shared principal code. *Done when:* new tests in
  `Api/AuthEndpointTests` pass:
  - `StartPhone_DemoNumber_IsReady`: the theory covers every number format
    above.
  - `StartPhone_UnknownNumber_ReturnsUnknownPhone` and
    `StartPhone_InvalidNumber_ReturnsValidationProblem`.
  - `VerifyPhone_TeamNumberAndDemoCode_ReturnsBearerToken`, with `me` then
    returning Jordan Lee and `teamMember`.
  - `VerifyPhone_PetParentNumberAndDemoCode_ReturnsBearerToken`.
  - `VerifyPhone_WrongCode_ReturnsWrongCode`.
  - `VerifyPhone_InactiveAccount_ReturnsInactiveAccount`.
  - `PhoneSignIn_WhenDemoSignInIsOff_ReturnsPhoneSignInOff`: a host with the
    setting off, for both endpoints.

  The existing email tests still pass.
- [x] **Step 2 - phone form** - `PhoneSignInForm`, `finishSignIn`, the new
  `authApi` calls, the demo panel. *Done when:*
  - `authApi.test.ts` covers both phone calls and each failure code.
  - `SignInPage.test.tsx` covers:
    - a number field error
    - the ready message and focus on the code field
    - a code field error
    - each phone message
    - "Use a different number" and "Send again"
    - phone success for each account, continuing to the right page
  - The email tests still pass, and all client tests, lint and build pass.

## Files / areas

- `vetiflow.Server/Controllers/AuthController.cs`,
  `Contracts/Auth/PhoneStartRequest.cs`, `PhoneVerifyRequest.cs` (new),
  `Hosting/DemoSignIn.cs` (new: the setting name, the code and number
  normalizing)
- `vetiflow.Server/appsettings.Development.json`
- `vetiflow.Server.Tests/Infrastructure/VetiFlowApiFactory.cs` (setting on),
  `Api/AuthEndpointTests.cs`
- `vetiflow.client/src/services/authApi.ts` and its test, `types/Auth.ts`
- `vetiflow.client/src/components/auth/PhoneSignInForm.tsx` (new),
  `EmailSignInForm.tsx`, `routes/SignInPage.tsx` and its test

## Data / contracts

- No entity or migration change.
- `POST /api/auth/phone/start`:
  - request `{ "phoneNumber": string }` (at most 30 characters)
  - `200 {}`
  - `400` validation problem
  - `401` with `code` `unknownPhone` or `inactiveAccount`
  - `403` with `code` `phoneSignInOff`
- `POST /api/auth/phone/verify`:
  - request `{ "phoneNumber": string, "code": string }` (6 digits)
  - `200` token response, the same as email sign-in
  - `400`, `401` (`unknownPhone`, `inactiveAccount` or `wrongCode`), `403`
    (`phoneSignInOff`)
- Setting `DemoSignIn:Enabled` (bool, default off). The demo environment
  (8.10) turns it on. Production with real data never does.

## Security

- The fixed code works only when `DemoSignIn:Enabled` is `true`. Without it,
  phone sign-in is refused, so a production deploy with real data can't be
  signed into by a published code.
- No SMS service, no outbound call, nothing stored between the two steps.
- The codes reveal which demo numbers exist; that is accepted for the demo
  only (project plan section 10 limits). Attempt limits come with S.9.
- Phone numbers and codes are never logged and never returned.

## Testing

- Server, real Postgres: the new `AuthEndpointTests` (step 1), including a
  host with the setting off.
- Client: `authApi.test.ts`, `SignInPage.test.tsx`.
- `/check`:
  - Local API through `db-target.ps1 -StartApp`: start and verify for
    312-555-0101 give a token whose `me` is Jordan Lee; a wrong code gives
    `wrongCode`.
  - The browser steps are yours: the Phone tab for both numbers, at phone
    width and by keyboard.

## Notes for the AI

- One number parser on the server (`DemoSignIn.TryNormalizePhone`) and a
  matching check on the client for the field error; the server decides.
- Reuse `CreatePrincipal` and `SignInFailed` in `AuthController`; don't
  duplicate the token code.
- **Deploy note for the PR:** to try phone sign-in on the deployed demo, set
  `DemoSignIn__Enabled=true` on Render. Without it the Phone tab answers
  "turned off".

## Result

- **Prepared:** branch `feature/demo-phone-sign-in`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T13:09:56Z, feature/demo-phone-sign-in @ 7f0857d)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, `AuthEndpointTests` 29/29; step 2, client 122/122, types, lint and build clean.
- **Check (local API through `db-target.ps1 -StartApp`):** `phone/start` for "(312) 555-0101" answered 200; `phone/verify` with a wrong code answered 401 `wrongCode`; with 123456 it returned a bearer token whose `me` is Jordan Lee, `teamMember`. Browser steps not run (no browser tool).
- **Beyond the listed files:** `vetiflow.client/src/components/auth/signInMessages.ts` (the failure messages both forms share), plus styles in `SignInForm.module.scss` and the unused `.comingSoon` removed from `SignInPage.module.scss`.
- **Audit:** recommended, not run (a second way to get a session token, behind a setting)
- **Follow-ups added to build plan:** none
- **Deploy notes:** set `DemoSignIn__Enabled=true` on Render to try phone sign-in on the deployed demo; without it the Phone tab answers "turned off". No migration.
