# Feature: Startup migrations and seeding controlled by settings

**From build-plan:** feature S.1
**Status:** complete
**Branch:** `fix/startup-migrations`
**Audit:** recommended - changes how the production database is migrated and what the app does at startup (application config and database behaviour).

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

Stop every deploy from migrating and seeding the production database by
accident. Migrating and seeding become settings: off by default, on for local
development and tests. Production migrates only when a person turns the setting
on for that deploy, and the app refuses to start against a database that is
behind, instead of serving 500s.

## In scope

- Two settings, both `false` unless set:
  `Database:MigrateOnStartup` and `Database:SeedDemoData`
  (`Database__MigrateOnStartup`, `Database__SeedDemoData` as environment
  variables, the names in `project-plan.md` section 8).
- Startup in `Program.cs`, moved into one small `DatabaseStartup` method:
  1. `MigrateOnStartup` on: apply migrations (as today).
  2. Off, database reachable, migrations pending: log the pending migration
     names and stop startup with an error naming the setting to turn on.
  3. Off, database unreachable: log a warning and start anyway, so
     `/api/health` reports `disconnected` (yesterday's outage stays visible).
  4. `SeedDemoData` on and the database reachable: seed (still only into an
     empty database).
- `appsettings.Development.json` turns both on, so `scripts/db-target.ps1
  -StartApp` and `dotnet run` locally behave as today.
- The test host (`VetiFlowApiFactory`) turns both on explicitly.
- A short runbook for the production migration step in `project-plan.md`
  section 8.

## Out of scope

- A separate database user for migrations: S.11.
- Session pooler, forwarded headers, CORS from configuration: S.3.
- Render auto-deploy and CI gating of deploys: 1.6 and the planned 1.8 (a
  dashboard setting, not code).
- Any change to migrations or the model.

## Build steps

- [x] **Step 1 - failing startup tests.** Add
  `vetiflow.Server.Tests/Api/StartupTests.cs`, each test on its own new
  database:
  - `Startup_WithDefaultSettings_RefusesPendingMigrations`: a host in the
    `Production` environment with only the connection string set fails to
    start, and the error names `Database__MigrateOnStartup`.
  - `Startup_WithMigrateOnStartup_AppliesMigrations`: no pending migrations
    after startup.
  - `Startup_WithSeedOff_LeavesDatabaseEmpty`: migrate on, seed off, zero cases.
  - `Startup_WithDatabaseUnreachable_StartsAndReportsUnhealthy`: connection
    string to a closed local port; the host starts and `GET /api/health`
    returns 503 `disconnected`.
  *Done when:* the tests compile, and against today's always-migrate startup
  every test except `Startup_WithMigrateOnStartup_AppliesMigrations` fails
  (`/test StartupTests`).
- [x] **Step 2 - settings and startup.** `DatabaseStartup` in
  `vetiflow.Server/Data/`, called from `Program.cs`; read the two settings with
  `GetValue<bool>` (no options class); turn both on in
  `appsettings.Development.json` and in `VetiFlowApiFactory`. Update the
  comments that say startup always migrates and seeds (`Program.cs`,
  `VetiFlowApiFactory`, `DbSeederTests`).
  *Done when:* `StartupTests` pass, and the whole server suite still passes
  (startup is shared code).
- [x] **Step 3 - runbook.** In `project-plan.md` section 8, replace the
  "planned by S.1" note with: defaults, local values, and the production step
  (set `Database__MigrateOnStartup=true` on Render, deploy, check the log and
  `/api/health`, set it back to `false`). Say that a deploy needing a migration
  fails while the setting is off, and Render keeps the previous build serving.
  *Done when:* the section names both settings, their defaults, and the four
  production steps.
- [x] **Step 4 - Verify and local check.** Full `scripts/verify.ps1`; then
  `/check`: start the app with `scripts/db-target.ps1 -StartApp` and observe
  that it starts and `GET /api/health` returns `healthy`.
  *Done when:* both pass.

## Files / areas

- `vetiflow.Server/Program.cs`, `vetiflow.Server/Data/DatabaseStartup.cs` (new)
- `vetiflow.Server/appsettings.Development.json`
- `vetiflow.Server.Tests/Api/StartupTests.cs` (new),
  `Infrastructure/VetiFlowApiFactory.cs`, `Data/DbSeederTests.cs` (comment)
- `blueprint/project-plan.md` (section 8)

## Data / contracts

- Settings: `Database:MigrateOnStartup` (bool, default `false`),
  `Database:SeedDemoData` (bool, default `false`). Later features keep these
  names.
- No model, migration, endpoint or hub change.

## Security

- No new surface.
- Logs name pending migrations and the setting to change; never the connection
  string, host or credentials.
- Production can no longer change its schema or insert demo rows unless a
  person sets the variable on Render.

## Testing

- Server, against real Postgres (Testcontainers):
  `StartupTests.Startup_WithDefaultSettings_RefusesPendingMigrations`,
  `Startup_WithMigrateOnStartup_AppliesMigrations`,
  `Startup_WithSeedOff_LeavesDatabaseEmpty`,
  `Startup_WithDatabaseUnreachable_StartsAndReportsUnhealthy`. Every existing
  test still passes with the factory turning both settings on.
- Client: none.
- `/check`: `db-target.ps1 -StartApp` starts the app (Development: migrate and
  seed on); `/api/health` returns `healthy`.

## Notes for the AI

- Keep `DatabaseStartup` plain: one static async method taking the context,
  the two flags and a logger. No interface, options class or hosted service.
- The pending-migration error must stop startup before `app.Run()`, so Render
  marks the deploy failed and keeps the previous one.
- Reachability: `Database.CanConnectAsync()`; do not catch broad exceptions
  around `MigrateAsync`, which should still fail loudly when the flag is on.
- After merge, Render needs no change: the production schema is already
  current, and both settings default to off.
- Never run migrations against production from this machine; the local check
  goes through `db-target.ps1`.

## Result

- **Prepared:** branch `fix/startup-migrations`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T13:58:49Z UTC, `fix/startup-migrations` @ 6e46ac9; that run was a fresh full run in Windows PowerShell 5.1)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests (33 of 33)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** `scripts/db-target.ps1 -StartApp` reported `Database target: local`; the app started in Development, ran the migrate and seed path (no migrations pending locally), and `GET https://localhost:7274/api/health` returned `{"status":"healthy","database":"connected"}`. The app was stopped afterwards. Before the change, three of the four `StartupTests` failed as predicted.
- **Audit:** recommended, not run (changes production migration behaviour and startup).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** no Render change needed: production's schema is current and both settings default to off. From now on a deploy that adds a migration fails until `Database__MigrateOnStartup=true` is set on Render for that deploy (runbook in `project-plan.md` section 8); 0.2b is the first.
