# Fix: Demo pet for Morgan Hale

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/demo-pet-for-morgan-hale`
- **Audit:** recommended - changes seed data (`DbSeeder`), though low risk: demo rows only, and only where demo seeding is on

## The problem

On a database seeded before owners existed, the demo pet parent sees "We
don't have any pets linked to your account yet", so the pet parent half of
the sign-in demo shows nothing.

- **Where:** `vetiflow.Server/Data/DbSeeder.cs`, `SeedDemoAccountsAsync`.
  When Morgan Hale is missing (S.18b), it creates him with no pets.
- **Why:**
  - Migration `AddOwners` added `Patient.OwnerId` as nullable with no
    backfill, so on older databases the seeded dog Buddy has no owner.
  - A fresh seed links Buddy to Morgan Hale, which is why the tests pass.
- **To reproduce:**
  1. Run the app on a database seeded before 2026-10-26 (your local one).
  2. Sign in as `parent@vetiflow.demo`.
  3. `GET /api/pet-parent/pets` returns `[]` (seen in S.18c's local check).

## The fix

On every demo seed (`Database:SeedDemoData` on), after the accounts: if the
demo Morgan Hale owns no pets, give him the dog a fresh seed would.

- If a patient named Buddy, species Dog, has no owner, link him to Morgan
  Hale. That is the seeded Buddy on an older database, and his active case,
  if any, shows as "In our care".
- Otherwise, create a fictional Buddy (Dog, Golden Retriever, male intact)
  for Morgan Hale. He has no case, so he shows "Not with us right now".

Because it checks "owns no pets" rather than "was just created", it also
mends databases where S.18b already created Morgan Hale (your local one, and
production if its demo seed ran), with no reset. Once he has a pet it does
nothing, so later boots change nothing. It never re-links a pet that already
has an owner, never touches any other patient, and never creates a case.

## Build steps

- [x] **Step 1 - failing tests** - in `DbSeederTests`:
  - `SeedAsync_LinksTheOwnerlessBuddyToMorganHale`: a database with an
    ownerless Buddy that has an active case. After seeding twice, Buddy
    belongs to Morgan Hale, the case is unchanged, and no second Buddy
    exists.
  - `SeedAsync_CreatesBuddyForMorganHaleWhenNoneIsFree`: a database with
    cases but no free Buddy. After seeding twice, exactly one new Buddy
    belongs to Morgan Hale.
  - `SeedAsync_MendsAMorganHaleCreatedWithoutPets`: Morgan Hale and the
    accounts already exist, he has no pets, and an ownerless Buddy exists.
    After seeding, Buddy is his.
  - `SeedAsync_NeverRelinksAnOwnedBuddy`: a Buddy with another owner keeps
    that owner.

  *Done when:* the first three fail on today's code, and the fourth passes.
- [x] **Step 2 - fix** - a `LinkDemoPetAsync` step in `DbSeeder.SeedAsync`,
  run after the accounts. *Done when:*
  - All four tests pass, and every other seeder, startup and pet parent test
    still passes.
  - The local check through `db-target.ps1 -StartApp` shows
    `GET /api/pet-parent/pets` as the demo pet parent listing Buddy, in
    care.

## Verify

- `DbSeederTests` (real Postgres): the four new tests.
- `scripts/verify.ps1` passes.
- Locally: restart the app (demo seeding is on in Development) and sign in
  as `parent@vetiflow.demo`. "Your pets" shows Buddy, "In our care".
- Production: the next deploy with `Database__SeedDemoData=true` mends it
  the same way.

## Result

- **Prepared:** branch `fix/demo-pet-for-morgan-hale`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T02:34:33Z, fix/demo-pet-for-morgan-hale @ c594836)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, the three behaviour tests failed on the old code and `SeedAsync_NeverRelinksAnOwnedBuddy` passed; step 2, `DbSeederTests` + `StartupTests` + `PetParentEndpointTests` + `AuthEndpointTests` 40/40.
- **Check (local, through `db-target.ps1 -StartApp`):** starting the app linked the local database's ownerless Buddy to the demo Morgan Hale; `GET /api/pet-parent/pets` as `parent@vetiflow.demo` returned `[{"name":"Buddy","species":"Dog","inCare":true}]`.
- **Audit:** recommended, not run (seed data change, low risk)
- **Follow-ups added to build plan:** none
- **Deploy notes:** none in code. Production's demo pet parent gets Buddy on the next deploy with `Database__SeedDemoData=true`.
