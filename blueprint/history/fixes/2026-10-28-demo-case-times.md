# Fix: Demo cases show waits of about 1,190 hours

**Type:** Fix
**Status:** complete
**Branch:** `fix/demo-case-times`
**Audit:** recommended - startup changes stored rows (case times) when demo seeding is on.

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

On the live demo (https://vetiflow.vercel.app), every card on the ER board
shows a wait of about 1,190 hours, so the board doesn't look like a working
ER.

- `DbSeeder.SeedCasesAsync` (`vetiflow.Server/Data/DbSeeder.cs:201`)
  stores times relative to the moment of seeding: Buddy arrives 18 minutes
  before, Luna 42 minutes before, Max 67 minutes before. Their vitals,
  triage, tasks and timeline events are stamped the same way.
- `SeedAsync` seeds cases only while the table is empty (`DbSeeder.cs:17`), so
  those times are never touched again. The live database was seeded about
  seven weeks ago.
- `CaseTimer` counts from `arrivalTime`, so the waits keep growing.

**To reproduce:** seed a database, move every case time back 50 days, and
open the board. Every timer shows over 1,000 hours.

## The fix

When demo seeding is on (`Database:SeedDemoData`), startup brings stale demo
times forward:

- **When:** the newest active case (`DischargedAt` null) arrived more than
  12 hours ago. Fresh data is left alone, so a case someone added a moment
  ago doesn't jump.
- **What:** every stored time on every case moves forward by the same amount.
  The newest active case then arrived 18 minutes ago, as on a fresh seed. The
  gaps between all the times stay exactly the same.
- **Which times:**
  - `EmergencyCases`: arrival, last update, last owner update, discharge
  - `CaseTasks`: due, created, resolved
  - `VitalsRecords`: recorded
  - `TriageAssessments`: assessed
  - `CaseEvents`: created
  - `AiSummaries`: generated, reviewed
  - `Handoffs`: created, acknowledged
- **How:** one set-based `UPDATE` per table (`ExecuteUpdateAsync`) in a single
  transaction, so a failure leaves every time as it was.

It must not break:

- **Seeding stays a no-op when it's off,** which is the default and the only
  setting allowed with real data (project plan section 9). `SeedDemoData`
  gates this like every other seed step.
- **Order and gaps are kept,** so the board sort (untriaged, acuity, then
  wait) and the case timeline stay the same.
- **No sign-in or account times move:** `Account.CreatedAt` is untouched.
- **No new setting, package or migration.**

## Build steps

- [x] **Step 1 - failing tests** - in `DbSeederTests` on a fresh database:
  - `SeedAsync_BringsStaleDemoTimesForward`: seed, move every case time back
    50 days, seed again. The newest active arrival is now 18 minutes ago
    (within a minute), and the gaps between arrivals, vitals, triage, tasks
    and events are unchanged.
  - `SeedAsync_LeavesRecentCaseTimesAlone`: seed, move times back 2 hours,
    seed again. Nothing moved.
  - `SeedAsync_MovesDischargedCaseTimesWithTheRest`: a discharged case's
    arrival and discharge move by the same amount.

  *Done when:* the first and third fail and the second passes, before the fix.
- [x] **Step 2 - fix** - `DbSeeder.RefreshDemoTimesAsync`, called from
  `SeedAsync` after the existing steps. *Done when:* all three tests pass and
  the rest of `DbSeederTests` still pass.

## Verify

- `dotnet test --project vetiflow.Server.Tests --filter-class "*DbSeederTests"`
  on real Postgres, then the full Verify.
- After merge and deploy, the board on https://vetiflow.vercel.app shows Buddy
  at about 18 minutes, Luna about 42 and Max about 67. The times then count up
  as normal. A startup refreshes them again only once the newest active case
  is more than 12 hours old; Render's free tier restarts after idling, so that
  happens on its own. Nothing changes in Render's settings.

## Notes for the AI

- Keep it in `DbSeeder`, next to the other demo-only steps, with a comment
  saying why. The 12 hours and 18 minutes are named constants.
- `ExecuteUpdateAsync` with `SetProperty(x => x.ArrivalTime, x => x.ArrivalTime + offset)`.
  Nullable times stay null.
- Don't change `CaseTimer` or any client code.

## Open questions

Approving the spec accepts these defaults:

- **Refresh threshold:** 12 hours since the newest active arrival.
- **Anchor:** the newest active case arrived 18 minutes ago (Buddy, as seeded).

## Result

- **Prepared:** branch `fix/demo-case-times`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-28 (reused from 2026-10-28T03:54:14Z, fix/demo-case-times @ 8ca25a2; the run before it was fresh)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, `DbSeederTests` with the three new tests: `SeedAsync_BringsStaleDemoTimesForward` and `SeedAsync_MovesDischargedCaseTimesWithTheRest` failed (newest active arrival 50 days 18 minutes old), `SeedAsync_LeavesRecentCaseTimesAlone` passed. Step 2, 14/14.
- **Check (local API through `db-target.ps1 -StartApp`, on a database seeded earlier):** after startup, `GET /api/cases` as the demo team member gave Buddy 18 min, Luna 42 min, Max 67 min.
- **Beyond the spec:** `CaseTasks.ResolvedAt` moves too (listed in the fix, not in the test's time list, since no seeded task is resolved).
- **Audit:** recommended, not run (startup changes stored case times when demo seeding is on).
- **Follow-ups:** none.
- **Deploy notes:** none. Render already has `Database__SeedDemoData=true`, so the first startup after this deploy brings the live demo times forward. No migration.
