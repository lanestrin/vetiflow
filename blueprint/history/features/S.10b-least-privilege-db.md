# Feature: Least-privilege database user

**From build-plan:** feature S.10b
**Status:** complete
**Branch:** `chore/least-privilege-db`
**Audit:** recommended - build plan phase S; database privileges, RLS policies, a migration and startup's migration path

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

In production the API connects as a role that can read and write rows but
cannot change the schema, so a bug or an injected query cannot drop or alter a
table. Migrations run through a separate, privileged connection that exists
on Render only for the length of a migration deploy.

## In scope

- A migration that creates a `vetiflow_app` role (`NOLOGIN`; the password is
  set by hand in Supabase, never in a migration) and, on every table, grants
  it row access and adds an RLS policy for it. Today the API reads the tables
  only because it owns them; a non-owner role sees nothing under RLS with no
  policies (`RowLevelSecurityTests.NonOwnerRole_ReadsNoRows`).
- `Migrations/AppRoleAccess.cs`: the one helper a migration calls to give the
  app role a new table, so later tables can't be forgotten (a test fails if
  one is).
- `ConnectionStrings:VetiFlowMigrations`: when `Database:MigrateOnStartup` is
  on, startup migrates with this string if it is set, otherwise with the app's
  own (local development and tests keep working unchanged).
- Tests against real Postgres for the role's rights and for a host that runs
  as the app role while migrating through the privileged connection.
- Project plan section 8: the new setting, the changed migration steps, and
  the one-time production cutover. Coding standards: the RLS rule now has one
  policy, for `vetiflow_app`.

## Out of scope

- Doing the production cutover: Render deploys `main`, so it happens after the
  merge (the steps are in Deploy notes and project plan section 8).
- Running other tests as the app role: `VetiFlowApiFactory` keeps the test
  superuser, so existing tests are unchanged; the new tests cover the role.
- Revoking `DELETE` (8.13, once the schema is final).
- A separate role for reads (no reporting user is planned).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - app role migration** - with `/migration AddAppRole`: a
  migration that creates `vetiflow_app` if it does not exist (a `DO` block
  that ignores `duplicate_object`, since roles are server-wide and test
  databases migrate in parallel), grants `USAGE` on schema `public`, and calls
  `AppRoleAccess.Grant` for every current table (the 11 in
  `EnableRowLevelSecurity` plus `VitalsRecords`). `Grant` gives `SELECT, INSERT,
  UPDATE, DELETE` (see Decisions) and creates policy `vetiflow_app_rows` (`FOR ALL ... USING
  (true) WITH CHECK (true)`); for `__EFMigrationsHistory` it gives `SELECT`
  only, with a `FOR SELECT` policy, so startup can check pending migrations.
  `Down` drops the policies and revokes the grants but leaves the role (other
  databases on the server may use it). *Done when:* new
  `Data/AppRoleTests` pass: `EveryPublicTable_HasAppRolePolicy`,
  `AppRole_ReadsAndWritesCases`, `AppRole_CanReadMigrationHistory`,
  `AppRole_CannotWriteMigrationHistory`, `AppRole_CannotChangeSchema` (theory:
  `CREATE TABLE`, `ALTER TABLE "EmergencyCases" ADD COLUMN`, `DROP TABLE
  "Rooms"` each fail with `42501`) and `AppRole_CanDeleteRows`; `MigrationTests` and `RowLevelSecurityTests` still pass;
  `has-pending-model-changes` reports none.
- [x] **Step 2 - migration connection** - `DatabaseStartup.PrepareAsync` takes
  an optional migration connection string; when migrating, it migrates through
  a short-lived context on that string, then seeds through the app's context.
  `Program.cs` reads `ConnectionStrings:VetiFlowMigrations`. *Done when:* new
  `StartupTests` pass: `Startup_AsAppRole_WithMigrationConnection_ServesBoard`
  (a login role in `vetiflow_app` as the app's string, the admin string as the
  migration string, migrate and seed on; `GET /api/cases` is `200` with the
  seeded cases and a stage update is `204`) and
  `Startup_AsAppRole_WithoutMigrationConnection_RefusesToMigrate` (startup
  throws, the schema is unchanged); the existing `StartupTests` still pass.
- [x] **Step 3 - docs** - project plan section 8: add
  `ConnectionStrings__VetiFlowMigrations` to "Secrets and rotation" (set only
  during a migration deploy; rotation of the app password is `ALTER ROLE`),
  change the migration steps to set and remove it with
  `Database__MigrateOnStartup`, and add the one-time cutover. Coding
  standards (EF Core): a migration that adds a table enables RLS and calls
  `AppRoleAccess.Grant`; the only policy is the app role's. Update the
  comments in `RowLevelSecurityTests`. *Done when:* the text matches the code
  and `secrets-config.tests.ps1` still passes.

## Files / areas

- `vetiflow.Server/Migrations/<timestamp>_AddAppRole.cs` (+ Designer)
- `vetiflow.Server/Migrations/AppRoleAccess.cs` (new)
- `vetiflow.Server/Data/DatabaseStartup.cs`, `vetiflow.Server/Program.cs`
- `vetiflow.Server.Tests/Data/AppRoleTests.cs` (new)
- `vetiflow.Server.Tests/Api/StartupTests.cs`,
  `vetiflow.Server.Tests/Data/RowLevelSecurityTests.cs` (comments)
- `blueprint/project-plan.md`, `blueprint/context/coding-standards.md`
- `blueprint/build-plan.md` (new item 8.13, per Decisions)

## Data / contracts

- Role `vetiflow_app` (`NOLOGIN` from the migration; `LOGIN` and a password
  are set by hand in production). Later migrations must keep the name.
- Every table: grants to `vetiflow_app` and policy `vetiflow_app_rows`.
  `__EFMigrationsHistory`: `SELECT` only.
- `anon` and `authenticated` still have no policy and read nothing.
- No entity or column changes; the migration has an unchanged model snapshot.
- New setting `ConnectionStrings:VetiFlowMigrations` (optional; a secret).
- No endpoint or hub changes.

## Security

- The app role cannot create, alter or drop tables, or write migration
  history. It is not the tables' owner and does not bypass RLS.
- The privileged string lives on Render only during a migration deploy. If
  someone turns on `Database__MigrateOnStartup` without it, the app role's
  migration fails and the deploy fails, so the previous build keeps serving.
- No password in a migration, test fixture file, log or doc. Test login roles
  use a generated name and password, are made in the test and dropped after.
- After the cutover, check `has_schema_privilege('vetiflow_app', 'public',
  'CREATE')` is `false` in Supabase: Postgres 15+ removes `CREATE` on `public`
  from everyone, but this confirms Supabase's own grants don't give it back.

## Testing

- Server, real Postgres: `Data/AppRoleTests` (step 1); two new `StartupTests`
  (step 2). Existing `MigrationTests`, `RowLevelSecurityTests`,
  `StartupTests`, `CasesEndpointTests` unchanged and passing.
- Client: none.
- `/check`: not before the merge; nothing changes locally. After the cutover,
  `/check guide` gives you the production steps and what to see
  (`/api/health` `healthy`, the board loads, a stage change saves).

## Notes for the AI

- The secret-command hook blocks commands that name connection-string
  variables. Set `ConnectionStrings:VetiFlowMigrations` in tests through
  `UseSetting`, never in a shell command.
- Role and table names can't be SQL parameters. Use constants or generated
  hex names only, as `RowLevelSecurityTests` does.
- `CREATE ROLE` is server-wide; the test login roles must be dropped in a
  `finally`, after the host is disposed.
- Supabase's pooler accepts a custom role as `vetiflow_app.<project-ref>`;
  the cutover steps say so.

## Deploy notes (after the merge)

1. Render: set `Database__MigrateOnStartup=true` and
   `ConnectionStrings__VetiFlowMigrations` to the current `postgres` pooler
   string; save, and let the deploy apply `AddAppRole`.
2. Supabase SQL editor: `ALTER ROLE vetiflow_app WITH LOGIN PASSWORD '<new,
   generated>';` then check the `has_schema_privilege` query above is `false`.
3. Render: set `ConnectionStrings__VetiFlowDatabase` to the pooler string with
   user `vetiflow_app.<project-ref>` and that password; delete
   `ConnectionStrings__VetiFlowMigrations` and `Database__MigrateOnStartup`;
   save.
4. Check `GET /api/health` is `healthy`, the board loads and a stage change
   saves.

## Decisions

- **Delete rights (2026-10-26):** the app role gets `SELECT, INSERT, UPDATE,
  DELETE` for now (`AppRole_CanDeleteRows`). New build-plan item 8.13 revokes
  `DELETE` once the back-end schema is final, keeping it only where a feature
  needs it (owner data deletion, 8.5).

## Result

- **Prepared:** branch `chore/least-privilege-db`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T22:44:22Z, chore/least-privilege-db @ 47f424a)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, `AppRoleTests` + `MigrationTests` + `RowLevelSecurityTests` 20/20, `has-pending-model-changes` none, `AddAppRole` applied to the local database through `db-target.ps1 -Migrate`; step 2, `StartupTests` + `AppRoleTests` + `ErrorResponseTests` 20/20.
- **Beyond the listed files:** `vetiflow.Server.Tests/Infrastructure/AppRoleLogin.cs`, a throwaway login in `vetiflow_app` (generated name and password, dropped after) that the two new `StartupTests` use.
- **Check:** not run - nothing changes locally; the production cutover (Deploy notes above, project plan section 8) ends with its own check of health, the board and a stage change
- **Audit:** recommended, not run (phase S; database privileges, RLS policies, a migration, startup's migration path)
- **Follow-ups added to build plan:** 8.13 `chore/revoke-app-delete` (revoke `DELETE` once the schema is final)
- **Deploy notes:** the one-time cutover in "Deploy notes (after the merge)" above
