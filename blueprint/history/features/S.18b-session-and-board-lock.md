# Feature: Session and board lock

**From build-plan:** feature S.18b
**Status:** complete
**Branch:** `feature/session-and-board-lock`
**Audit:** recommended - build plan phase S; puts authorization on the board API and adds client route guards

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

The ER board is no longer public. Only a signed-in hospital team member can
load it or move a case. Every page sends people where their account belongs,
a pet parent never sees the board, and an expired session says so instead of
breaking (project plan section 10, acceptance criteria 6 and 7).

## In scope

- **Server:** `CasesController` requires the `TeamMember` policy (S.17).
  - `GET /api/cases` and `PATCH /api/cases/{id}/stage` answer `401` when
    signed out and `403` for a pet parent. Both are ProblemDetails, through
    the existing status code pages.
  - Health and the auth endpoints stay as they are.
- **Client API:**
  - `getEmergencyCases` and `updateCaseStage` send
    `Authorization: Bearer <token>` from the session.
  - A `401` throws a `SessionEndedError`; a `403` throws an
    `AccessDeniedError`.
- **Route guards** (`components/auth/RequireExperience`), with "Checking your
  session…" while `/api/auth/me` answers:
  - `/er` needs a team member.
  - `/pet-parent` needs a pet parent.
  - No token: go to `/sign-in`.
  - Token refused: clear it and go to `/sign-in` with the session-ended
    message.
  - The wrong experience goes to that account's own home: a pet parent on
    `/er` lands on `/pet-parent`, and a team member on `/pet-parent` lands on
    `/er`.
- **`/`:** goes to `/er` or `/pet-parent` by experience, or to `/sign-in`
  when signed out (it opens the board directly today).
- **`/sign-in` when already signed in:** goes straight to that account's
  home.
- **Session ended:** when the board's data call gets `401`, or a guard finds
  the token refused, the sign-in page shows "Your session ended. Sign in
  again." in its status message.
- **Session bar** (`components/auth/SessionBar`) on the board and the pet
  parent home: "Signed in as Jordan Lee (demo)" and a Sign out button. Sign
  out clears the token and goes to `/sign-in`, so the back button can't
  reopen the board.
- **`/pet-parent`:** the page no longer checks the session itself. The guard
  hands it the signed-in user; the "This page is for pet parents" and
  sign-in-link states go.

## Out of scope

- The pet parent's pets (S.18c); phone sign-in (S.19).
- Sign-in on the SignalR hub (S.7): it still connects without a token and
  sends case IDs only. The board refetches through the locked API, so no
  case data reaches a signed-out client.
- Token refresh, idle timeout and quick lock (S.14).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - lock the board API** - `[Authorize(Policy = AuthNames.TeamMemberPolicy)]`
  on `CasesController`. Tests sign in for real:
  - `VetiFlowApiFactory` gains `CreateSignedInClientAsync(email)`, which
    signs in a seeded demo account.
  - `CasesEndpointTests`, `ErrorResponseTests` and the startup test that
    serves the board use the team member's client.
  - The oversized-body image test moves to `POST /api/auth/email`, an open
    endpoint that reads its body: authorization now answers before the board
    endpoint would read one.

  *Done when:* new `CasesEndpointTests` pass:
  `GetCases_SignedOut_Returns401Problem`,
  `GetCases_AsPetParent_Returns403Problem`,
  `UpdateStage_SignedOut_Returns401AndLeavesCaseAlone` and
  `UpdateStage_AsPetParent_Returns403AndLeavesCaseAlone`. Every existing
  server test passes, including `ServerImageTests`.
- [x] **Step 2 - client token and guards** - `casesApi` sends the token and
  throws the two typed errors; `RequireExperience`, the `/` redirect, the
  signed-in redirect on `/sign-in`, and the session-ended message;
  `ErBoardPage` sends people to `/sign-in` with that message on
  `SessionEndedError`. *Done when:*
  - `casesApi.test.ts` checks the header and both errors.
  - `RequireExperience.test.tsx` covers: no token; refused token, with the
    message and a cleared token; matching experience; and each wrong
    experience.
  - `App.test.tsx` covers `/` for each experience and signed out, and
    `/sign-in` when signed in.
  - `SignInPage.test.tsx` shows the session-ended message.
  - `ErBoardPage.test.tsx` covers a `401` during the board load sending the
    person to sign in.
- [x] **Step 3 - session bar and sign out** - `SessionBar` on both pages;
  `PetParentHomePage` takes the user from the guard. *Done when:*
  `SessionBar.test.tsx` checks the name, the "(demo)" label, and that Sign
  out clears the token and goes to `/sign-in`. The board and pet parent tests
  show the bar, and all client tests, lint and build pass.
- [x] **Step 4 - demo people on older databases** (added 2026-10-27 with
  your OK; see Decisions). The local check found that a database seeded
  before owners existed has no Jordan Lee or Morgan Hale, so S.16's seeder
  skipped both accounts and nobody could sign in to the locked board.
  `DbSeeder` now creates the fictional Jordan Lee (veterinarian) and Morgan
  Hale (owner, synthetic contact details) when either is missing, then links
  the accounts. *Done when:*
  `DbSeederTests.SeedAsync_CreatesMissingDemoPeopleForTheAccounts` passes (a
  database with cases but neither person gets both people and both linked
  accounts, once), the existing seeder tests still pass, and the local API
  check signs in both accounts: `GET /api/cases` gives `401` signed out,
  `403` as the pet parent and `200` as the team member.

## Decisions

- **Seed missing demo people (2026-10-27):** rather than skip the demo
  accounts when the seeded people are missing, the seeder creates them. That
  keeps the board reachable after the lock on any database with demo seeding
  on, with no data reset.

## Files / areas

- `vetiflow.Server/Data/DbSeeder.cs`, `vetiflow.Server.Tests/Data/DbSeederTests.cs`
  (step 4).

- `blueprint/build-plan.md`: your rewording of 1.7 (PR descriptions and
  release notes), included in this branch at your choice (2026-10-27).

- `vetiflow.Server/Controllers/CasesController.cs`
- `vetiflow.Server.Tests/Infrastructure/VetiFlowApiFactory.cs`,
  `Api/CasesEndpointTests.cs`, `Api/ErrorResponseTests.cs`,
  `Api/StartupTests.cs`, `Deployment/ServerImageTests.cs`
- `vetiflow.client/src/services/casesApi.ts` and its test
- `vetiflow.client/src/components/auth/RequireExperience.tsx`,
  `SessionBar.tsx` (new, with modules and tests)
- `vetiflow.client/src/app/App.tsx`, `routes/ErBoardPage.tsx`,
  `routes/SignInPage.tsx`, `routes/PetParentHomePage.tsx` and their tests

## Data / contracts

- No entity, migration or DTO change.
- `GET /api/cases` and `PATCH /api/cases/{id}/stage`:
  - `401` ProblemDetails without a valid token
  - `403` ProblemDetails for a pet parent
  - otherwise unchanged
- Client routes:
  - `/`: home by experience
  - `/er`: team members only
  - `/pet-parent`: pet parents only
  - `/sign-in`: when signed in, goes home
- Hub: unchanged.

## Security

- The board's data and stage changes need a team member's token. Pet
  parents can't reach the board by API or by URL (the hard rule "owners
  never see the staff board").
- Client guards are for the experience only; the server's `401` and `403`
  are the real check.
- Sign out removes the token from `sessionStorage`. Tokens are not revoked on
  the server (bearer tokens can't be). They expire after the default hour,
  and S.14 adds a shorter timeout.
- The hub stays open (S.7) and sends IDs only.

## Testing

- Server, real Postgres: the four new `CasesEndpointTests`; the updated
  `CasesEndpointTests`, `ErrorResponseTests`, `StartupTests` and
  `ServerImageTests` (Docker).
- Client: `casesApi.test.ts`, `RequireExperience.test.tsx`,
  `SessionBar.test.tsx`, `App.test.tsx`, `SignInPage.test.tsx`,
  `ErBoardPage.test.tsx`, `PetParentHomePage.test.tsx`.
- `/check`:
  - `curl` the board API locally: no token gives `401`, the pet parent's
    token gives `403`, and the team member's gives `200`.
  - The browser steps are yours (`/check guide`): sign in as each account,
    try `/er` as the pet parent, sign out, then press back.

## Notes for the AI

- **Deploy order matters.** After this merges, the deployed board needs a
  sign-in, so the deployed database must have the demo accounts first: one
  Render deploy with `Database__SeedDemoData=true` before (or with) this
  merge. Say so in the PR's Deploy notes.
- Keep `RequireExperience` a small wrapper that renders its child with the
  user (a render prop). No auth context or state library: two pages use it.
- `ErBoardPage` keeps showing its existing error for other failures; only
  `SessionEndedError` navigates. An `AccessDeniedError` can't happen behind
  the guard, but if it does, go to `/pet-parent`.
- Pass the session-ended message as router state (`{ sessionEnded: true }`),
  not as a query string.

## Result

- **Prepared:** branch `feature/session-and-board-lock`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T02:00:29Z, feature/session-and-board-lock @ 47c0053)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, whole server suite 136/136 including `ServerImageTests`; steps 2 and 3, client 96/96 across 17 files, types and lint clean; step 4, `DbSeederTests` + `StartupTests` + `AuthEndpointTests` 29/29.
- **Check (local API through `db-target.ps1 -StartApp`, on the person's existing database):** the first run found `unknownAccount` for both demo emails, because the database predates the demo people and S.16's seeder skipped the accounts. Step 4 was added with the person's OK. After it: `GET /api/cases` 401 signed out, 403 as the pet parent, 200 as the team member; `/api/auth/me` "Jordan Lee", `teamMember`. Browser steps were not run (no browser tool).
- **Beyond the listed files:** `vetiflow.Server.Tests/Infrastructure/DemoAccounts.cs` (signs in a seeded demo account); client `components/auth/useSession.ts`, `HomeRedirect.tsx`, `SessionCheckMessage.tsx`, `experienceHome.ts` and `services/apiErrors.ts` (the session hook, `/` redirect, checking message, home paths and typed errors the guards share); the person's 1.7 rewording in `build-plan.md`, included at their choice.
- **Audit:** recommended, not run (authorization on the board API and client guards)
- **Follow-ups added to build plan:** none
- **Deploy notes:** the deployed board now needs a sign-in. With this merge (or right after), run one Render deploy with `Database__SeedDemoData=true`, then turn it off; step 4 makes that create the demo accounts even on an older database. No migration.
