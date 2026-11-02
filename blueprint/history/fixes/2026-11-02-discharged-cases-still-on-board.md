# Fix: Discharge-stage cases saved before 4.21a still show on the ER board

**Type:** Fix
**Status:** complete
**Branch:** `fix/discharged-cases-still-on-board`
**Audit:** recommended - a data migration that changes stored case rows (sets discharge times and so frees rooms) in every database it runs on, including the deployed one.

## The problem

Poppy (Demo Family 10) is in the Discharge stage but still appears on the ER
board, in the Stable lane, with "Discharge · 751 min".

The board lists cases with no discharge time
(`vetiflow.Server/Controllers/CasesController.cs:41`,
`.Where(emergencyCase => emergencyCase.DischargedAt == null)`). Since 4.21a a
move to Discharge through Update status records `DischargedAt`, and the demo
seed gives its Discharge-stage case one (`vetiflow.Server/Data/DbSeeder.cs:121`).
But the seed only runs into an empty database (`DbSeeder.cs:17`), and 4.21a
deliberately did not backfill existing rows ("the demo reseeds"). Any database
seeded or used before 4.21a still holds Discharge-stage cases with
`DischargedAt = null`, so they stay on the board, keep their room, and count in
the board summary.

Reproduce: in a database that held cases before 4.21a, a case with `Stage`
`Discharge` and `DischargedAt` null is listed by `GET /api/cases`.

## The fix

A data-only migration, `BackfillDischargedAt`, that sets
`"DischargedAt" = "StageEnteredAt"` (when the case entered the Discharge
stage) for every case with `"Stage" = 'Discharge'` and `"DischargedAt" IS NULL`.
This restores the 4.21a rule for old rows: the case leaves the board, its room
is free, and it shows as Discharged in Visit History with a real time.

It must not break:

- Cases in other stages and cases already discharged keep their values.
- No model change: `dotnet ef migrations has-pending-model-changes` reports none.
- No timeline entry is written: the actor and moment of the original move are
  not known, and the timeline only records what happened.
- `Down` does nothing: the filled rows can't be told apart afterwards, and old
  demo data needs no rollback (no backward compatibility at this stage).

No change to the board query, the seed or `EmergencyCase`.

## Build steps

- [x] **Step 1 - failing test** - `MigrationTests.BackfillDischargedAt_DischargesOldDischargeStageCases`: migrate to `AddCaseTags`, insert a Discharge-stage case with no discharge time, an active Triage-stage case and an already discharged Discharge-stage case, then migrate to the latest. *Done when:* the test fails before the migration exists (the first case's `DischargedAt` is still null), observed with `/test`.
- [x] **Step 2 - fix** - add the `BackfillDischargedAt` migration with the update above, using `/migration`. *Done when:* the test passes: the first case's `DischargedAt` equals its `StageEnteredAt` and the other two are unchanged; `Migrations_ApplyRollBackAndReapplyCleanly` passes; `has-pending-model-changes` reports none; the whole server suite passes (database change).

## Verify

- `MigrationTests.BackfillDischargedAt_DischargesOldDischargeStageCases` and
  `Migrations_ApplyRollBackAndReapplyCleanly` against real Postgres
  (Testcontainers); the whole server suite.
- In the app: apply the migration locally with `scripts/db-target.ps1 -Migrate`
  (or start with `-StartApp`); the ER board no longer shows Poppy, and Patients →
  Poppy → Visit History shows the visit as Discharged with a time.
- Deploy note: the migration must run on the deployed database before Render's
  board changes. Because it needs a migration run, the commit is `fix!:` with a
  `BREAKING CHANGE:` footer naming that step.

## Result

- **Prepared:** branch `fix/discharged-cases-still-on-board`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-02, scope server (reused from 2026-11-02T00:35:05Z, fix/discharged-cases-still-on-board @ 9353a88)
  - PASS  Workflow tests
  - PASS  Docker
  - PASS  Server build
  - PASS  Server tests
  - Not needed: client steps (no client files changed)
- **Step evidence:** the new test failed before the migration existed (`DischargedAt` null where `2026-10-30T19:40:00+00:00` was expected). After it, the whole server suite passed (578), and `has-pending-model-changes` reported none.
- **Check:** not run. The migration was applied to the local database with `scripts/db-target.ps1 -Migrate` (target confirmed local; the backfill `UPDATE` ran), but the board was not looked at in the running app.
- **Audit:** recommended, not run (not requested).
- **Follow-ups added to build plan:** none. Fixes are not added to the build plan; the person's 2026-11-02 decision that case tags are chosen from a fixed list, not typed, is to be planned as its own build-plan item next.
- **Deploy notes:** run migrations on the deployed database (`20261102002838_BackfillDischargedAt`, data only). On Render, migrations run only when the deploy step or `Database__MigrateOnStartup` runs them; until then the deployed board still shows old Discharge-stage cases.
