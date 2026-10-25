# Fix: Verify script gaps

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/verify-script-gaps`
- **Audit:** required - changes Verify, the check every `/implement`, `/complete` and `/approve` gate relies on (a workflow skill's safety checks)
- **Fixes:** F-06 (P3, from `blueprint/history/fixes/2026-10-24-commit-and-pr-drafts.md`; added on this branch with the person's OK)

## The problem

`scripts/verify.ps1` can report success, or fail with an unclear message, in
four cases, and `/status` raises one false warning and one wrong suggestion.

1. **The migration check can be skipped silently.** When `dotnet ef` is not
   installed, Verify records `SKIP  No pending model changes` and still exits 0
   (`scripts/verify.ps1:55-68`, `exit 0` at line 89). `/complete` gate 3 and
   `/approve` refuse a SKIP, but a plain `/verify` or a person reading the exit
   code sees success. Nothing in the repo pins `dotnet-ef`: there is no
   `.config/dotnet-tools.json`, so it depends on a global install and its
   version. Repro: `dotnet tool uninstall --global dotnet-ef`, run Verify, exit
   code is 0.
2. **`node_modules` goes stale.** `npm ci` runs only when `node_modules` is
   missing (`scripts/verify.ps1:74-76`). After a pull or branch switch that
   changes `vetiflow.client/package-lock.json`, Verify lints, builds and tests
   against the old packages. Repro: change a version in `package-lock.json` (or
   check out a branch that does), run Verify, no `Client install` step runs.
3. **Docker not running fails late and noisily.** Server tests need Docker for
   Testcontainers unless `VETIFLOW_TEST_POSTGRES` is set. With Docker stopped,
   Verify builds, then every database test fails with a long Testcontainers
   stack. Repro: stop Docker Desktop, run Verify.
4. **A running app breaks the build with MSB3027.** When
   `dotnet run --project vetiflow.Server` is running, `vetiflow.Server.exe` is
   locked and `Server build` fails with MSB3027 retries and no hint. Repro: start
   the app, run Verify.
5. **`/status` flags 1.3 as missing a history file.** Its drift check ("a ticked
   build-plan item with no history file", `.claude/skills/status/SKILL.md:31`)
   looks for a file per ID, but 1.3 shipped inside 1.2's
   (`blueprint/history/features/1.2-test-suite.md:3`, "From build-plan: features
   1.2 and 1.3"; build plan line 44).
6. **F-06: `/status` can suggest `/approve` on `main`.** The row "Stub spec,
   `landing-commit.txt` present, uncommitted changes -> `/approve`"
   (`.claude/skills/status/SKILL.md:40`) also matches `main` after a merge when
   old drafts were not deleted and other files are changed. `/approve` then
   stops safely, but `/status` pointed at the wrong command.

## The fix

- **Pin and restore `dotnet-ef`.** Add `.config/dotnet-tools.json` with
  `dotnet-ef` `10.0.11` (matches `Microsoft.EntityFrameworkCore.*` in
  `vetiflow.Server.csproj`). Verify runs `dotnet tool restore` as a step before
  the migration check, then always runs the check. Remove the SKIP branch, so a
  missing tool is a FAIL with a clear message, never a SKIP. `dotnet ef ...` in
  `CLAUDE.md` keeps working (local tools take precedence).
- **Reinstall when the lockfile changed.** Run `Client install` (`npm ci`) when
  `node_modules/.package-lock.json` is missing or older than `package-lock.json`.
- **Check Docker first.** Before `Server build`, unless `VETIFLOW_TEST_POSTGRES`
  is set, run `docker info` quietly (with the same try/catch as the old ef probe
  for Windows PowerShell 5.1). If it fails, record `FAIL  Docker (not running:
  start Docker Desktop or set VETIFLOW_TEST_POSTGRES)` and stop.
- **Hint on the locked exe.** If `Server build` fails and a `vetiflow.Server`
  process is running, print one line: "vetiflow.Server is running and locks its
  exe (MSB3027). Stop it, then rerun."
- **`/status`:** a ticked item counts as having history when a file's name starts
  with its ID or its `From build-plan` line names the ID.
- **F-06:** narrow the `/approve` row to "on a work branch (not `main`) with a
  history file for it", the same condition as `/approve` check 2.
- **Docs:** update "What it runs" and the problem table in
  `.claude/skills/verify/SKILL.md` (SKIP row becomes a tool-restore FAIL row; add
  the Docker row's new message).

Must not break: `-ServerOnly` / `-ClientOnly`; Windows PowerShell 5.1 and pwsh;
`VETIFLOW_TEST_POSTGRES` without Docker; the summary format the skills read
(`PASS`/`FAIL`/`SKIP` + step name). CI (`.github/workflows/ci.yml`) does not call
Verify yet, so it is unchanged here; making it do so is build-plan 1.6.

## Build steps

There are no tests for the script itself (no Pester set up), so each step is
proven by running Verify in the repro situation.

- [x] **Step 1 - pin dotnet-ef, no SKIP.** Add `.config/dotnet-tools.json`, a
  `Tool restore` step, and an unconditional migration check.
  *Done when:* Verify shows `PASS  Tool restore` and `PASS  No pending model
  changes`; with the global `dotnet-ef` uninstalled it still passes; the string
  `SKIP` no longer appears in `verify.ps1`.
- [x] **Step 2 - stale `node_modules`.** Lockfile-time comparison.
  *Done when:* after `touch vetiflow.client/package-lock.json`, Verify runs
  `Client install`; a second run skips it.
- [x] **Step 3 - Docker check and MSB3027 hint.**
  *Done when:* with Docker stopped and no `VETIFLOW_TEST_POSTGRES`, Verify stops
  before `Server build` with the one-line Docker FAIL and exit 1; with the app
  running, `Server build` fails and the hint line prints.
- [x] **Step 4 - `/status` history check and verify skill docs.**
  *Done when:* `/status` on `main` reports no drift warning for 1.3; the verify
  skill describes the new steps and messages.
- [x] **Step 5 - F-06.** Narrow the `/status` `/approve` row.
  *Done when:* the row requires a work branch and a history file for it,
  matching `/approve` check 2.

## Verify

- `pwsh -File scripts/verify.ps1` and
  `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1` both pass with
  every step PASS, including `Tool restore`, and exit 0.
- The repro for each of problems 1-4 now gives the result in its *Done when*.
- `/status` shows no 1.3 warning.

## Findings

One `/audit` run on 2026-10-25 found F-07 and F-08, both P3, left open (repair
later with `/fix F-07`). F-06 from the previous fix is repaired here (Step 5).

### F-07 [P3] open - Docker probe treats any stderr as "not running" on Windows PowerShell 5.1
**Where:** `scripts/verify.ps1:60-66`
**Problem:** With `$ErrorActionPreference = 'Stop'`, Windows PowerShell 5.1 turns
any line a native command writes to redirected stderr into a terminating error.
If `docker info` prints a warning to stderr while the engine is running (Docker
Desktop does this in some WSL2 setups), the `catch` sets `$dockerRunning = $false`
and Verify stops with `FAIL  Docker (not running ...)`. The old ef probe had the
same pattern, but there a misread gave a SKIP; now it blocks Verify. Not seen on
this machine: the 5.1 run passed.
**Fix:** set `$ErrorActionPreference = 'Continue'` inside the `try` (or call
`docker info --format '{{.ServerVersion}}'`, which prints no warnings) and keep
`$LASTEXITCODE` as the only signal.

### F-08 [P3] open - Missing blank line between the problem table and the next heading
**Where:** `.claude/skills/verify/SKILL.md:63-64`
**Problem:** The new "Tool restore fails" row replaced the table's last row and the
blank line after it, so `## Unexpected files` follows the table directly. It
renders, but differs from every other section in the skill files.
**Fix:** add the blank line back.

## Result

- **Shipped:** branch `fix/verify-script-gaps`, squash-merged to `main` (the commit subject carries the PR number)
- **Verify:** `scripts/verify.ps1` on 2026-10-25 (Windows PowerShell 5.1; `pwsh` is not installed on this machine)
  - PASS  Server build
  - PASS  Server tests
  - PASS  Tool restore
  - PASS  No pending model changes
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests (39 of 39)
- **Check:** each repro run against the real script.
  - Docker unreachable (`DOCKER_HOST=tcp://127.0.0.1:1`, no `VETIFLOW_TEST_POSTGRES`): only `FAIL  Docker (not running: ...)`, stopped before `Server build`, exit 1.
  - `package-lock.json` touched: run 1 did `PASS  Client install`, run 2 skipped it.
  - App running plus a server rebuild (newer `Program.cs` timestamp): MSB3027 "locked by vetiflow.Server", the hint line printed, `FAIL  Server build`, exit 1. With no server change the build passes while the app runs, because MSBuild does not copy the exe.
  - `/status` 1.3 rule: `1.2-test-suite.md` names 1.3 in its `From build-plan` line.
  - Not observed: Verify with the global `dotnet-ef` uninstalled (left installed); `dotnet tool list --local` shows the pinned 10.0.11 from `.config/dotnet-tools.json`.
- **Audit:** required (changes Verify, which every gate relies on). Run once: F-07 and F-08 [P3] open; F-06 repaired.
- **Follow-ups added to build plan:** none (F-07 and F-08 go through `/fix`).
- **Deploy notes:** none. Developers get `dotnet-ef` from the repo with `dotnet tool restore`, which Verify runs; a global install is no longer needed.
