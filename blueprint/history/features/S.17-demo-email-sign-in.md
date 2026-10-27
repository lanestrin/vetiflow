# Feature: Demo email sign-in

**From build-plan:** feature S.17
**Status:** complete
**Branch:** `feature/demo-email-sign-in`
**Audit:** recommended - build plan phase S; adds authentication (password checks, token issuing) to `Program.cs` and a new auth endpoint

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

An email and password from a demo account (S.16) can be exchanged for a
session token, and the token says who is signed in and which experience they
get. This is what the login page (S.18) calls. Nothing changes for current
users yet (project plan section 10).

## In scope

- Authentication in `Program.cs`: ASP.NET Core's built-in bearer token
  (`AddAuthentication(...).AddBearerToken()`, shared framework, no new
  package), `UseAuthentication()` before `UseAuthorization()`, and a
  `TeamMember` authorization policy (claim `kind` = `TeamMember`) ready for
  S.18.
- `POST /api/auth/email` with `{ email, password }`:
  - **Validation:** both required; email at most 254 characters and in email
    format; password at most 128 characters. A bad request gets a `400`
    `ValidationProblemDetails`.
  - **Lookup:** the email is trimmed and lower-cased, then matched against an
    account with that email.
  - **Success:** an active account whose password verifies with
    `PasswordHasher<Account>` gets `200` with the framework's token response
    (`tokenType`, `accessToken`, `expiresIn`, `refreshToken`).
  - **Failure:** `401` ProblemDetails with a `code` the client turns into the
    demo message (labels live in the client):
    - `unknownAccount`: no account has that email, or it has no password
    - `wrongPassword`
    - `inactiveAccount`
- Token claims:
  - the account id
  - `kind` (`TeamMember` or `PetParent`)
  - the display name: the staff member's or owner's first and last name
- `GET /api/auth/me` (signed in only) returns `{ name, experience }`, with
  `experience` either `teamMember` or `petParent`. Without a valid token it
  answers `401` ProblemDetails.
- Build plan: S.17 and S.18 lines updated so the board lock moves to S.18
  (see Notes).

## Out of scope

- Locking `GET /api/cases` and the stage update to team members: S.18 does
  it together with the login page, so the deployed board never breaks
  between the two PRs.
- The sign-in screen, routing and sign out (S.18); phone sign-in (S.19).
- Refreshing tokens (no refresh endpoint; when the token expires the user
  signs in again), rate limiting and lockout (S.9), hub sign-in (S.7).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - email sign-in** - authentication setup and
  `Controllers/AuthController.cs` with `POST /api/auth/email`; request DTO in
  `Contracts/Auth/`. *Done when:* new `Api/AuthEndpointTests` pass:
  - `SignInByEmail_TeamDemoAccount_ReturnsBearerToken` (the seeded
    `team@vetiflow.demo` / `welcome1`)
  - `SignInByEmail_PetParentDemoAccount_ReturnsBearerToken`
  - `SignInByEmail_TrimsAndIgnoresCase` (`"  Team@VetiFlow.demo "`)
  - `SignInByEmail_UnknownEmail_ReturnsUnknownAccount`
  - `SignInByEmail_WrongPassword_ReturnsWrongPassword`
  - `SignInByEmail_InactiveAccount_ReturnsInactiveAccount`
  - `SignInByEmail_InvalidRequest_ReturnsValidationProblem` (theory: no
    email, not an email, no password, too long)
  - `SignInByEmail_ResponseNeverContainsPasswordHash`

  Each `401` is ProblemDetails with its `code`.
- [x] **Step 2 - who is signed in** - `GET /api/auth/me`. *Done when:*
  `Me_WithTeamToken_ReturnsTeamMemberExperience` (name "Jordan Lee",
  `teamMember`), `Me_WithPetParentToken_ReturnsPetParentExperience` (name
  "Morgan Hale", `petParent`), `Me_WithoutToken_Returns401Problem` and
  `Me_WithMadeUpToken_Returns401Problem` pass; `CasesEndpointTests`,
  `ErrorResponseTests` and `CorsTests` still pass unchanged.
- [x] **Step 3 - build plan** - S.17 drops "the board and stage endpoints
  require a hospital team member"; S.18 gains it. *Done when:* both lines say
  so and nothing else changed.

## Files / areas

- `vetiflow.Server/Program.cs`
- `vetiflow.Server/Controllers/AuthController.cs` (new)
- `vetiflow.Server/Contracts/Auth/EmailSignInRequest.cs`,
  `Contracts/Auth/SignedInUserDto.cs` (new)
- `vetiflow.Server.Tests/Api/AuthEndpointTests.cs` (new)
- `blueprint/build-plan.md`

## Data / contracts

- No entity, column or migration change.
- `POST /api/auth/email`
  - request `{ "email": string, "password": string }`
  - `200` `{ "tokenType": "Bearer", "accessToken", "expiresIn", "refreshToken" }`
  - `400` validation problem
  - `401` problem with `code`: `unknownAccount`, `wrongPassword` or
    `inactiveAccount`
- `GET /api/auth/me`: `200` `{ "name": string, "experience": "teamMember" | "petParent" }`,
  or `401` problem.
- Clients send `Authorization: Bearer <accessToken>`. The token lasts the
  framework's default of one hour.
- Policy name `TeamMember`; claim `kind`. S.18 and S.19 keep both.
- Hub: unchanged.

## Security

- `POST /api/auth/email` is anonymous by design; `GET /api/auth/me` needs a
  token. The board and health endpoints are unchanged in this item.
- Passwords are checked with `PasswordHasher`; the hash, the password and the
  email are never returned, logged or put in the token. The token holds the
  account id, kind and display name only.
- The `code` values tell a caller which accounts exist. That is accepted for
  the demo (project plan section 10, limits); production uses one generic
  answer (S.5), and S.9 adds rate limiting.
- Tokens are signed with ASP.NET Core data protection; a made-up or altered
  token gets `401`.

## Testing

- Server, real Postgres (`Api/AuthEndpointTests`, through `VetiFlowApiFactory`,
  which seeds the demo accounts): the step 1 and step 2 tests. An inactive
  account is made in the test with `TestData` and a hashed password.
- Client: none.
- `/check`: not needed; every behaviour is an HTTP response the tests assert.
  The first visible check is S.18.

## Notes for the AI

- **Why the board lock moves to S.18:** the current client calls
  `GET /api/cases` without a token. Locking it here would make the deployed
  board fail with `401` until S.18 ships the login page. S.18 adds the lock,
  the token on board requests, and the redirect in one PR.
- Return the token with the controller's `SignIn(principal,
  BearerTokenDefaults.AuthenticationScheme)`, which writes the standard token
  response.
- Write the `401` problems with `Problem(statusCode: 401, title: ...)` and add
  `code` to `Extensions`; keep titles generic ("Sign-in failed"), since the
  demo wording lives in the client.
- Never log the request body.

## Result

- **Prepared:** branch `feature/demo-email-sign-in`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T01:05:17Z, feature/demo-email-sign-in @ 692fea0)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** `AuthEndpointTests` + `CasesEndpointTests` + `ErrorResponseTests` + `CorsTests` + `StartupTests` 59/59. The first run caught an empty password passing validation (C#'s `required` allows `""`); `[Required]` on both fields fixed it.
- **Beyond the listed files:** `vetiflow.Server/Hosting/AuthNames.cs` (the `kind` claim and `TeamMember` policy names, reused by S.18 and S.19); `SignInByEmail_TooLongPassword_ReturnsValidationProblem` as its own test.
- **Check:** not run - every behaviour is an HTTP response the tests assert; the first visible check is S.18
- **Audit:** recommended, not run (adds authentication)
- **Follow-ups added to build plan:** none new; the board lock moved from S.17 to S.18
- **Deploy notes:** none (no migration or setting). Tokens are signed with data protection keys that a redeploy replaces, so a redeploy signs everyone out (project plan section 10 limits).
