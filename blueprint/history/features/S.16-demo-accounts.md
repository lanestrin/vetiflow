# Feature: Demo accounts

**From build-plan:** feature S.16
**Status:** complete
**Branch:** `feature/demo-accounts`
**Audit:** recommended - build plan phase S; a new table holding sign-in credentials (password hashes), its migration, RLS grants and seed data

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

The database knows who can sign in and what each account is: a hospital team
member linked to a `StaffMember`, or a pet parent linked to an `Owner`. Two
fictional demo accounts exist for the sign-in demo. This is the first step
toward the login page (S.18); nothing is visible yet (project plan section 10).

## In scope

- `Account` entity and `AccountKind` enum (`TeamMember`, `PetParent`, stored
  as text), with the fields in project plan section 10: `Id`, `Kind`,
  `StaffMemberId`, `OwnerId`, `Email`, `PhoneNumber`, `PasswordHash`,
  `IsActive`, `CreatedAt`.
- Database rules (check constraints and indexes, tested on real Postgres):
  - Exactly one link that matches the kind: a team member has a
    `StaffMemberId` and no `OwnerId`; a pet parent the reverse.
  - At least one of `Email` and `PhoneNumber`.
  - `Email` stored lower-case. `PhoneNumber` stored as `+1` and 10 digits.
  - `Email`, `PhoneNumber`, `StaffMemberId` and `OwnerId` each unique when
    set (one account per person).
  - Foreign keys restrict deletes, like every other table.
- Migration `AddAccounts`: the table, RLS enabled, and
  `AppRoleAccess.Grant("Accounts")`, so the `vetiflow_app` role can use it.
- Password hashes from ASP.NET Core's built-in `PasswordHasher<Account>`
  (shared framework, no new package).
- Demo accounts in `DbSeeder`, only when demo seeding is on and no account
  exists yet (the case seed returns early once any case exists, so accounts
  get their own check and link to the seeded people by name):
  - `team@vetiflow.demo`, `+13125550101`, team member linked to Jordan Lee
  - `parent@vetiflow.demo`, `+13125550102`, pet parent linked to Morgan Hale
  - both with password `welcome1`
- Build plan: move the M3a section ahead of M2 in file order (your choice,
  2026-10-27), so `/feature` with no ID takes S.17 next.

## Out of scope

- Signing in, tokens and endpoints (S.17); the screen (S.18); phone codes
  (S.19).
- Creating or editing accounts from the app (S.15, 9.1).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - entity, rules and migration** - `Models/Account.cs`,
  `AccountKind`, the `DbSet` and its configuration in `OnModelCreating`, then
  `/migration AddAccounts` with `ENABLE ROW LEVEL SECURITY` and
  `AppRoleAccess.Grant` added to `Up`. *Done when:* new
  `Data/AccountConstraintTests` pass:
  - `TeamMember_WithStaffLink_IsSaved` and `PetParent_WithOwnerLink_IsSaved`
  - `Account_WithLinkThatDoesNotMatchKind_IsRejected` (theory: team member
    with owner only, pet parent with staff only, both links, no link)
  - `Account_WithoutEmailOrPhone_IsRejected`
  - `Account_WithUpperCaseEmail_IsRejected`
  - `Account_WithBadPhoneFormat_IsRejected`
  - `Account_DuplicateEmail_IsRejected`, `Account_DuplicatePhone_IsRejected`
  - `Person_CannotHaveTwoAccounts`

  Also: `RowLevelSecurityTests`, `AppRoleTests` and `MigrationTests` pass,
  and `has-pending-model-changes` reports none.
- [x] **Step 2 - demo accounts** - seed the two accounts with hashed
  passwords. *Done when:* new `DbSeederTests`
  `SeedAsync_CreatesTheTwoDemoAccounts` (kinds, links to Jordan Lee and
  Morgan Hale, emails and phones as above, active),
  `SeedAsync_HashesDemoPasswords` (the hash isn't `welcome1` and
  `PasswordHasher` verifies `welcome1` and rejects another password), and
  `SeedAsync_AddsAccountsToAnAlreadySeededDatabase` (cases seeded first, then
  the seeder runs again and adds the accounts once) pass. The existing seeder
  tests still pass.
- [x] **Step 3 - build plan order** - move the "M3a: Sign-in proof of
  concept (demo)" section, unchanged, to sit before "M2", and change its
  intro to say it comes first at your request. *Done when:* every ID is still
  present once (the ID check), S.16 is the first unticked item, and no item
  line changed.

## Files / areas

- `vetiflow.Server/Models/Account.cs` (new)
- `vetiflow.Server/Data/VetiFlowDbContext.cs`, `vetiflow.Server/Data/DbSeeder.cs`
- `vetiflow.Server/Migrations/<timestamp>_AddAccounts.cs` (+ Designer, snapshot)
- `vetiflow.Server.Tests/Data/AccountConstraintTests.cs` (new),
  `vetiflow.Server.Tests/Data/DbSeederTests.cs`,
  `vetiflow.Server.Tests/Infrastructure/TestData.cs` (account helpers)
- `blueprint/build-plan.md`

## Data / contracts

- New table `Accounts`:

  | Column | Type | Rule |
  | --- | --- | --- |
  | `Id` | uuid | primary key |
  | `Kind` | text | `TeamMember` or `PetParent` |
  | `StaffMemberId` | uuid, null | FK `StaffMembers`, restrict, unique when set |
  | `OwnerId` | uuid, null | FK `Owners`, restrict, unique when set |
  | `Email` | text, null | lower-case, unique when set |
  | `PhoneNumber` | text, null | `+1` and 10 digits, unique when set |
  | `PasswordHash` | text, null | from `PasswordHasher` |
  | `IsActive` | boolean | default true |
  | `CreatedAt` | timestamptz | |

  Check constraints are named `CK_Accounts_KindMatchesLink`,
  `CK_Accounts_HasEmailOrPhone`, `CK_Accounts_EmailLowerCase` and
  `CK_Accounts_PhoneFormat`. Later items (S.17, S.19, S.5) keep these
  names.
- RLS on, policy `vetiflow_app_rows` (as every table).
- No endpoint, DTO or hub change.

## Security

- No new surface: no endpoint reads accounts yet.
- Only hashes are stored, never a password. The demo password `welcome1`
  is fictional and documented on purpose (section 10). Demo accounts exist
  only where demo seeding is on (8.10 keeps them out of production with real
  data).
- `PasswordHash`, email and phone never go in logs, hub messages or the board.

## Testing

- Server, real Postgres: `Data/AccountConstraintTests` (step 1),
  three new `DbSeederTests` (step 2), plus the existing RLS, app-role and
  migration tests.
- Client: none.
- `/check`: not needed; nothing is visible until S.18.

## Notes for the AI

- Write the check constraints with `ToTable(table => table.HasCheckConstraint(...))`
  so EF puts them in the migration and the snapshot.
- Unique indexes on nullable columns: Postgres allows many NULLs, so a plain
  unique index works; add `HasFilter` only if EF needs it for clarity.
- The seeder finds Jordan Lee and Morgan Hale by name; if either is missing
  (a database seeded differently), it skips that account rather than failing.
- The secret-command hook blocks commands that name connection-string
  variables; run tests and `db-target.ps1` by their usual commands only.

## Result

- **Prepared:** branch `feature/demo-accounts`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T00:37:02Z, feature/demo-accounts @ 0831b30)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, `AccountConstraintTests` + `RowLevelSecurityTests` + `AppRoleTests` + `MigrationTests` 35/35, `has-pending-model-changes` none, `AddAccounts` applied to the local database through `db-target.ps1 -Migrate`; step 2, `DbSeederTests` + `StartupTests` + `AccountConstraintTests` 27/27 (including seeding as the `vetiflow_app` role); step 3, the ID check shows no ID change and S.16 is the first unticked item.
- **Check:** not run - nothing is visible until S.18
- **Audit:** recommended, not run (a new table holding credentials)
- **Follow-ups added to build plan:** none
- **Deploy notes:** a new migration, `AddAccounts`. Run it as a migration deploy (project plan section 8): set `Database__MigrateOnStartup=true` and the migration connection string on Render for that deploy, then remove both. Without that, the deploy refuses to start and the previous build keeps serving. Render has demo seeding off, so the deployed database gets no demo accounts until a deploy runs with `Database__SeedDemoData=true` (needed for the sign-in demo in S.18).
