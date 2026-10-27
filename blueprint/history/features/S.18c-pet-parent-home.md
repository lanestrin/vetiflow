# Feature: Pet parent home

**From build-plan:** feature S.18c
**Status:** complete
**Branch:** `feature/pet-parent-home`
**Audit:** recommended - a new endpoint returning patient data scoped to an owner (owner scope is a hard rule)

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

A signed-in pet parent sees their own pets and whether each one is in the
hospital's care right now, in calm, plain words. They never see another
owner's pet, never reach a pet by ID, and never see acuity or clinical
detail (project plan sections 2, 7 and 10).

## In scope

- **`GET /api/pet-parent/pets`** (pet parents only, new `PetParent` policy):
  - The owner comes from the signed-in account: the token's account id leads
    to `Account.OwnerId`. The URL takes no id.
  - It returns the owner's patients as `{ name, species, inCare }`, where
    `inCare` means the patient has a case that isn't discharged.
  - Pets in care come first, then the rest by name. An owner with no pets
    gets an empty list.
  - Signed out answers `401`; a team member answers `403`.
- **`/pet-parent` page:**
  - Under "Welcome back, Morgan Hale", a "Your pets" list. Each pet shows its
    name, its species, and either "In our care" or "Not with us right now".
    The in-care state also has an icon and its own wording, not colour alone.
  - "Loading your pets…" while waiting.
  - With no pets: "We don't have any pets linked to your account yet. Ask the
    hospital team if this looks wrong."
  - If the list can't load: "We can't show your pets right now. Refresh the
    page to try again."
  - A `401` goes to sign-in with the session-ended message, as the board
    does.
  - It replaces the "Your pet's care updates will appear here." line.

## Out of scope

- Case details, stages, timers, notes or staff names for owners. Staff-
  approved owner updates are 6.5, and the full owner page is 6.3.
- Production owner access through expiring or revocable links (S.8).
- Live updates on this page (it loads once; a refresh shows changes).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - owner-scoped pets endpoint** - `AuthNames.PetParentPolicy`
  and its policy in `Program.cs`, `Controllers/PetParentController.cs` and
  `Contracts/PetParent/PetSummaryDto.cs`. *Done when:* new
  `Api/PetParentEndpointTests` (real Postgres) pass:
  - `GetPets_ReturnsOnlyTheSignedInOwnersPets`: a new owner and account,
    with two pets, while another owner's pet is never listed.
  - `GetPets_MarksInCare`: an active case gives `true`; a discharged case or
    no case gives `false`.
  - `GetPets_ListsInCareFirstThenByName`.
  - `GetPets_NoPets_ReturnsEmptyList`.
  - `GetPets_SignedOut_Returns401Problem` and
    `GetPets_AsTeamMember_Returns403Problem`.
  - `GetPets_NeverReturnsIdsOrOwnerDetails`: no `id` fields, and none of the
    owner's phone or email in the body.
- [x] **Step 2 - the pets on the page** - `services/petParentApi.ts`
  (`getMyPets`, with the token, `SessionEndedError` on `401`), and the "Your
  pets" list on `PetParentHomePage`. *Done when:*
  - `petParentApi.test.ts` checks the header and the `401`.
  - `PetParentHomePage.test.tsx` covers:
    - loading
    - a list with one pet in care and one not, each showing its words
    - the empty message
    - the error message
    - a `401` sending the person to sign-in with the session-ended message
  - All client tests, lint and build pass.

## Files / areas

- `vetiflow.Server/Hosting/AuthNames.cs`, `vetiflow.Server/Program.cs`
- `vetiflow.Server/Controllers/PetParentController.cs`,
  `Contracts/PetParent/PetSummaryDto.cs` (new)
- `vetiflow.Server.Tests/Api/PetParentEndpointTests.cs` (new),
  `Infrastructure/TestData.cs` (an account with the demo password, if needed)
- `vetiflow.client/src/services/petParentApi.ts` and its test (new),
  `src/types/PetSummary.ts` (new)
- `vetiflow.client/src/routes/PetParentHomePage.tsx`, its module and test

## Data / contracts

- No entity or migration change.
- `GET /api/pet-parent/pets`:
  - `200` with `[{ "name": string, "species": string, "inCare": boolean }]`
  - `401` and `403` as ProblemDetails
- Policy `PetParent` (claim `kind` = `PetParent`); later owner pages (6.3)
  keep it until S.8 decides production access.

## Security

- Only a pet parent's own pets: the owner is read on the server from the
  signed-in account, never from the request. That covers the hard rule
  "owners never reach a case or patient by ID alone".
- The response holds no IDs, no acuity, no case details, no staff names and
  no owner contact details.
- Nothing about owners or patients is logged.

## Testing

- Server, real Postgres: `Api/PetParentEndpointTests` (step 1). Tests sign in
  through the real endpoint with an account they create for a fresh owner,
  so other tests' rows never mix in.
- Client: `petParentApi.test.ts`, `PetParentHomePage.test.tsx`.
- `/check`:
  - Locally through `db-target.ps1 -StartApp`, `curl` as the demo pet
    parent: Buddy is listed as in care with no ids. The team member gets
    `403`, and signed out gets `401`.
  - The browser steps are yours: sign in as `parent@vetiflow.demo`, check the
    list at phone width and with the keyboard.

## Notes for the AI

- Read the account id from `ClaimTypes.NameIdentifier`, then load the
  `OwnerId` with `AsNoTracking`. If the account is gone or has no owner,
  answer `403` (shouldn't happen behind the policy).
- Project in one query: `Patients.Where(p => p.OwnerId == ownerId)` with
  `InCare = p.Cases.Any(c => c.DischargedAt == null)`, through the
  `EmergencyCases` set if `Patient` has no navigation.
- Client wording lives in the client; the API sends `inCare`, not text.
- Keep the in-care cue visible without colour: an icon plus the words.

## Result

- **Prepared:** branch `feature/pet-parent-home`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T02:17:30Z, feature/pet-parent-home @ 149e03c)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, `PetParentEndpointTests` + `AuthEndpointTests` + `CasesEndpointTests` 45/45 (the first run failed four tests on a test-helper tracking clash, fixed in the helper); step 2, client 104/104 across 18 files, types, lint and build clean.
- **Check (local API through `db-target.ps1 -StartApp`):** `GET /api/pet-parent/pets` 401 signed out, 403 as the team member, 200 `[]` as the demo pet parent. The list is empty because on that older database Morgan Hale was created by the S.18b seeder fix and owns no pets; listing and in-care with real pets are covered by the endpoint tests. Browser steps not run (no browser tool).
- **Beyond the listed files:** `vetiflow.client/src/components/petParent/PetCareList.tsx` (the list, one job per component) and a default `/api/pet-parent/pets` handler in `src/test/server.ts`.
- **Audit:** recommended, not run (owner-scoped patient data)
- **Follow-ups:** a small `/fix` so the seeder links a demo pet to Morgan Hale when it creates him, so the pet parent demo shows a pet on older databases too (not a build-plan item).
- **Deploy notes:** none (no migration or setting).
