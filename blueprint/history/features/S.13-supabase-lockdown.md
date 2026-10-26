# Feature: Lock VetiFlow tables away from Supabase's REST API

**From build-plan:** feature S.13
**Status:** complete
**Branch:** `fix/supabase-lockdown`
**Audit:** recommended - a migration that changes database access rules on every table (database behaviour, security foundations).

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

Supabase serves every table in `public` through its REST and GraphQL APIs to
the `anon` and `authenticated` roles, and the anon key is meant to be public.
VetiFlow's tables live in `public`, including `Owners` with contact details.
Turn on row level security with no policies on every VetiFlow table, so those
roles see and change nothing, while the API, which connects as the tables'
owner, keeps working.

## In scope

- Migration `EnableRowLevelSecurity`: `ALTER TABLE ... ENABLE ROW LEVEL
  SECURITY` on the ten model tables (`AiSummaries`, `CaseEvents`, `CaseTasks`,
  `EmergencyCases`, `Handoffs`, `Owners`, `Patients`, `Rooms`,
  `StaffMembers`, `TriageAssessments`) and on `__EFMigrationsHistory`, each
  listed by name. `Down` disables it again. No policies.
- A test that every table in `public` has RLS on, so a later migration that
  adds a table without it fails the build.
- A test that a non-owner role, granted `SELECT` the way Supabase grants
  `anon`, reads zero rows.
- The rule in `coding-standards.md` (EF Core and Postgres): every new table's
  migration enables RLS.

## Out of scope

- `FORCE ROW LEVEL SECURITY` and policies: the API connects as the owner, and
  no Supabase client reads these tables.
- Revoking the `anon` / `authenticated` grants: those roles exist only on
  Supabase, so revokes would break local and test migrations. RLS alone
  denies them.
- A separate least-privilege app user: S.11.
- Changing Supabase dashboard settings (for example turning off the Data API):
  a person can do that separately; the deploy note mentions it.

## Build steps

- [x] **Step 1 - failing tests.** Add `vetiflow.Server.Tests/Data/RowLevelSecurityTests.cs`
  on the shared test database (migrated by the factory):
  - `EveryPublicTable_HasRowLevelSecurity`: queries `pg_class` for ordinary
    tables in `public` without `relrowsecurity`; expects none.
  - `NonOwnerRole_ReadsNoRows`: saves a case, creates a temporary role (unique
    name, `NOLOGIN`), grants it `USAGE` on `public` and `SELECT` on
    `"EmergencyCases"`, then inside a transaction `SET LOCAL ROLE` to it and
    counts rows: zero. Drops the role afterwards.
  *Done when:* `/test RowLevelSecurityTests` shows both failing (today every
  table lists, and the role reads rows).
- [x] **Step 2 - migration.** `/migration EnableRowLevelSecurity`: an empty
  model migration with explicit `migrationBuilder.Sql` lines for the eleven
  tables, and the reverse in `Down`. Apply locally through
  `scripts/db-target.ps1 -Migrate`.
  *Done when:* `RowLevelSecurityTests` pass, `Model_MatchesLatestMigration` and
  `Migrations_ApplyRollBackAndReapplyCleanly` pass, and the whole server suite
  passes (it runs as the table owner, proving the app is unaffected).
- [x] **Step 3 - rule.** Add to `coding-standards.md`, EF Core and Postgres:
  "Every table in `public` has row level security enabled with no policies, so
  Supabase's REST API serves nothing. A migration that adds a table enables it
  (`RowLevelSecurityTests` checks)."
  *Done when:* the rule is in the section.
- [x] **Step 4 - Verify.** Full `scripts/verify.ps1`.
  *Done when:* it passes.

## Files / areas

- `vetiflow.Server/Migrations/<timestamp>_EnableRowLevelSecurity.cs` (new),
  its designer file, and the snapshot (unchanged model)
- `vetiflow.Server.Tests/Data/RowLevelSecurityTests.cs` (new)
- `blueprint/context/coding-standards.md` (one rule)

## Data / contracts

- Migration `EnableRowLevelSecurity`: RLS on for eleven tables, no policies;
  no column, index or data change. Later migrations that add a table must
  enable RLS on it.
- API and hub: no change.

## Security

- After deploy, Supabase's REST and GraphQL APIs return no rows from VetiFlow
  tables for `anon` and `authenticated`, and refuse writes.
- The API is unchanged: it connects as the table owner, which RLS does not
  restrict without `FORCE`.
- No secrets are needed to build or test this.

## Testing

- Server, against real Postgres (Testcontainers):
  `RowLevelSecurityTests.EveryPublicTable_HasRowLevelSecurity`,
  `RowLevelSecurityTests.NonOwnerRole_ReadsNoRows`, plus the existing
  migration tests and the whole suite running as owner.
- Client: none.
- `/check`: not needed locally. In production the person checks Supabase's
  Security Advisor after the deploy (see Deploy notes).

## Notes for the AI

- First production use of the S.1 runbook: after merge, set
  `Database__MigrateOnStartup=true` on Render, deploy, check the log and
  `/api/health`, set it back to `false`. Then the Supabase dashboard's
  Security Advisor should no longer report "RLS disabled in public" for these
  tables.
- The test role must be cluster-wide-unique (roles are shared across the
  test databases) and dropped in `finally`, after revoking its grants.
- Never run anything against the production database from this machine.

## Result

- **Prepared:** branch `fix/supabase-lockdown`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T15:41:33Z UTC, `fix/supabase-lockdown` @ bb94189; that run was a fresh full run in Windows PowerShell 5.1)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests (53 of 53)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** not run locally (no running-app change). Both `RowLevelSecurityTests` failed before the migration and pass after it. `EnableRowLevelSecurity` applied to the local database through `scripts/db-target.ps1 -Migrate` (target `local`, 11 statements).
- **Audit:** recommended, not run (migration changing access rules on every table).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** migration `EnableRowLevelSecurity` (RLS on 11 tables, no data change). First production use of the S.1 runbook: set `Database__MigrateOnStartup=true` on Render, deploy, check the log and `/api/health`, set it back to `false`. Then Supabase's Security Advisor should no longer report "RLS disabled in public" for VetiFlow tables.
