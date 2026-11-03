# Fix: Trim the demo board to 11 cases and add a local database reset

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/demo-seed-trim-and-local-reset`
- **Audit:** recommended - it adds a destructive database operation to `scripts/db-target.ps1` (safe only because of the local check), and the seeder changes existing data at startup, including on the demo deployment.

## The problem

The person wants fewer than 12 patients on the board (2026-11-03).

- **The seed puts 17 cases on every board.** `vetiflow.Server/Data/DbSeeder.cs` seeds 3 base cases (Max, Buddy, Luna) and 15 extra demo cases (`AdditionalCases`, lines 132-149). Only Poppy (index 10, stage Discharge) is seeded discharged, so 3 + 14 = 17 are active on a fresh database and on the demo deployment.
- **The local database has 30 active cases.** The extra 13 were made by hand or by `/check` runs: Toby, Juno, a second Nori, Pip, Rex, Kiwi, a second Olive, "Vitals check", "Empty check", and four "Check Assign/None" patients. The person called these "no longer suitable".
- **There's no safe way to clear the local database.**
  - The app has no delete endpoint.
  - Seven of the 13 are Incoming, and the server refuses to discharge an Incoming case without triage.
  - `scripts/db-target.ps1` offers only a check, `-Migrate` and `-StartApp`.
  - Claude must not read the connection string, and `dotnet ef database …` must never be run directly.

## The fix

### 1. Trim the seed to 11 active cases

Retire 6 of the 14 active extra cases by changing their seed `Stage` to `CaseStage.Discharge`. The seeder already discharges Discharge-stage fixtures (4.21a), so on a fresh database they become past visits in the patient history instead of board cases. Their indexes and IDs never change and are never reused.

- **Retired:**

  | Index | Patient | Acuity | Stage before |
  | --- | --- | --- | --- |
  | 1 | Pepper | Critical | Treatment |
  | 7 | Clementine | Urgent | Treatment |
  | 8 | Finn | Urgent | Incoming |
  | 12 | Nori | Stable | Triage |
  | 14 | Milo | Stable | Recheck |
  | 15 | Juniper | Stable | Incoming |

- **Kept extras (8):**
  - Winston Montgomery (critical, Diagnostics)
  - Olive (critical, Incoming, for the triage queue)
  - Jasper (critical, Triage)
  - Ruby (critical, Recheck)
  - Archie (urgent, Diagnostics)
  - Mabel (urgent, Recheck)
  - Theodore Roosevelt (stable, Diagnostics)
  - Hazel (stable, Treatment)
- **The board:** with Max, Buddy and Luna that makes 11 active cases: 6 critical, 3 urgent and 2 stable, with one Incoming. Every veterinarian and every technician keeps at least one active, non-incoming extra case under the 2.24 rotation: kept indexes 2, 4, 5, 6, 9, 11, 13 cover `index % 4` = 0, 1, 2, 3.
- **Databases that already have the retired cases active**, such as your local one and the demo deployment: a new startup step `DischargeRetiredDemoCasesAsync`, run once per startup after `SeedAdditionalCasesAsync`. For each fixture whose seed stage is Discharge and that is still active, it does what a discharge through Update status does (`CasesController`, lines 422-437):
  - moves the case to Discharge and records the discharge time once (`MoveToStage`, `RecordDischarge`);
  - clears a designated Next Care Action and records `NextActionCleared`, reason "patient discharged" (the 4.13a rule);
  - records a `Discharged` timeline event, with no staff member, as seeded events have none;
  - leaves everything else untouched: tasks, vitals and history stay. Non-fixture cases and kept fixtures are never touched. A second run changes nothing.
- **Not changed:** the 3 base cases; the 18 seeded cases in total (the retired ones still exist, discharged); the 6/6/6 acuity totals; the demo accounts, staff and rooms.

### 2. A local-only database reset

Add `-ResetLocal` to `scripts/db-target.ps1`:

- **What it runs:** `dotnet ef database drop --force --project vetiflow.Server`, with the same local check, binding and clean-up as `-Migrate`.
  - It runs nothing for a database that isn't local, isn't configured or can't be read.
  - It never prints the string.
  - It counts as one of the mutually exclusive operations (exit 3 with another).
- **Afterwards:** the next `-StartApp` migrates and seeds a fresh database, since the app does both on startup.
- **Destructive:** it deletes everything in the local database. The person runs it; Claude runs it only when the person asks.
- **Docs:** add it to the script's help, the CLAUDE.md hard rule and Commands, and the Safety section and controls table in `blueprint/context/ai-interaction.md`. Running `dotnet ef database drop` directly stays forbidden.

## Build steps

- [x] **Step 1 - failing tests** - new `DbSeederTests` cases (real Postgres):
  - `SeedAsync_LeavesElevenActiveCasesOnTheBoard`: a fresh seed has exactly the 11 named active cases.
  - `SeedAsync_DischargesRetiredDemoCasesInAnExistingDatabase`: a database where a retired fixture is still active and has a designated task, plus a non-fixture case. After `SeedAsync`:
    - the retired case is discharged, in Discharge, no longer designated, with one `Discharged` and one `NextActionCleared` event;
    - the non-fixture case and a kept fixture are unchanged;
    - a second `SeedAsync` adds no events.

  `secret-guardrails.tests.ps1` gains `-ResetLocal` in its operation loops:
  - it checks, then runs `ef database drop --force --project <dir>` with the string bound and none on the command line;
  - competing variables are removed and the string isn't printed;
  - it runs nothing for a remote target;
  - it gives a caller run with `&` its environment back;
  - it's refused together with another operation.

  *Done when:* the new tests fail for the expected reason (17 active cases; the retired fixture still active; `-ResetLocal` unknown).
- [x] **Step 2 - fix** - the six seed stages, `DischargeRetiredDemoCasesAsync`, `-ResetLocal` and the doc updates. *Done when:* the new tests pass; the existing `DbSeederTests` pass unchanged, including `SeedAsync_PopulatesEmptyDatabaseOnce` (18 cases, 6/6/6) and `SeedAsync_DischargesOnlyTheSeededDischargeStageCases`; the whole server suite and the workflow tests pass.

## Verify

- `scripts/verify.ps1` (server and workflow scope).
- **In the app**, after the person runs `scripts/db-target.ps1 -ResetLocal` and then `-StartApp`:
  - the board shows the 11 kept patients (6 critical, 3 urgent, 2 stable);
  - none of the 13 hand-made cases appear;
  - Patients still lists the retired six, with a discharged visit each.
- **Without a reset**, a plain `-StartApp` on the current local database discharges the six retired fixtures, but leaves the 13 hand-made cases on the board.
- I would run the reset only if you ask. Otherwise the check covers the no-reset path, and the reset is left for you.

## Deploy notes

- Where demo seeding is on (local and the demo deployment), the next startup discharges the six retired fixtures if they are still active. There's no migration or setting change.
- `-ResetLocal` is local only and never runs in deployment.

## Open questions

- None blocking. The retired six are my default, chosen for a spread of acuity, stage and staff. Name others to keep if you prefer, for example Pepper instead of Ruby.

## Result

- **Prepared:** branch `fix/demo-seed-trim-and-local-reset`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-03, scope server (reused from 2026-11-03T21:01:46Z, fix/demo-seed-trim-and-local-reset @ 36378df)
  - PASS  Workflow tests
  - PASS  Docker
  - PASS  Server build
  - PASS  Server tests
  - Not needed: client steps (no client files changed)
- **Failing tests first:** `SeedAsync_LeavesElevenActiveCasesOnTheBoard` failed with Clementine still active; `SeedAsync_DischargesRetiredDemoCasesInAnExistingDatabase` failed with the retired fixture not discharged; the `-ResetLocal` guardrail checks failed with the option unknown. After the fix: all 26 `DbSeederTests` pass (the existing 18-case, 6/6/6, discharge-stage and staff-spread tests unchanged), and all 310 secret-guardrail checks pass.
- **Check:** `db-target.ps1 -StartApp` on the existing local database (no reset). Startup discharged Pepper, Clementine, Finn, Nori, Milo and Juniper (stage Discharge, discharged, no designation); exactly the 11 kept seeded cases stayed active (Max, Buddy, Luna, Ruby, Winston Montgomery, Jasper, Olive, Mabel, Archie, Theodore Roosevelt, Hazel), with the 13 hand-made local cases still on the board (24 active). `-ResetLocal` was not run against the real local database: it is left for the person, per the spec; its behaviour is covered by the guardrail checks with a fake `dotnet`.
- **Built beyond the first draft:** in the guardrail tests `-ResetLocal` runs before `-StartApp`, because the launch-profile checks read the last run; the seeder step also records the `StageChanged` event, as the Update status endpoint does.
- **Audit:** recommended (a destructive database operation and a startup data change that also runs on the demo deployment), not run: `/audit` runs only on request.
- **Follow-ups added to build plan:** none.
- **Deploy notes:** where demo seeding is on, the next startup discharges the six retired fixtures if still active. No migration or setting change. `-ResetLocal` is local only.
