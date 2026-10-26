---
name: verify
description: Run scripts/verify.ps1 (workflow tests, server build and tests, client lint, build and tests) and report the real results. Use for /verify, before saying a change is done, and before /complete.
---

# verify - run every automated check

Run from the repo root and report the actual output. Never say a check passed
without running it.

## Run

```bash
pwsh -File scripts/verify.ps1
```

If `pwsh` is not installed, use
`powershell -ExecutionPolicy Bypass -File scripts/verify.ps1`.

Options: `-ServerOnly` when only `vetiflow.Server*` changed, `-ClientOnly` when
only `vetiflow.client/` changed. `/verify` and `/implement` always run it fresh
with no option. `/audit`, `/complete` and `/approve` use `-ReuseIfCurrent` (see
"Reusing a run").

## What it runs

1. Workflow tests: every `scripts/tests/*.tests.ps1` (the secret guardrails:
   the hook, `db-target.ps1`, `.claude/settings.json` and `.dockerignore`;
   Verify's own evidence and reuse rule; and the skill guards that keep
   `/ready`, `/complete` and `/approve` person-only). Runs in every mode.
2. Docker check: unless `VETIFLOW_TEST_POSTGRES` is set, stops with
   `FAIL  Docker` when `docker info` exits non-zero.
3. Server build (through the test project). If it fails while `vetiflow.Server`
   is running, it prints a hint that the app locks its exe (MSB3027).
4. Server tests: `dotnet test --project vetiflow.Server.Tests`. Needs Docker for
   Testcontainers, or `VETIFLOW_TEST_POSTGRES`. Includes `MigrationTests`, whose
   `Model_MatchesLatestMigration` fails when the model has changes no migration
   captures.
5. Client: `npm ci` when `node_modules/.package-lock.json` is missing or older
   than `package-lock.json`, then lint, build, and `npm run test -- --run`.

## Output, logs and evidence

- The console shows one `==> <step>` line per step and the summary. When a step
  fails, it also shows the last 60 lines of that step's log.
- Each step's full output is in `.verify/logs/<step>.log` (git-ignored, replaced
  on every run). Read it when the tail does not show the cause.
- Every run deletes `.verify/evidence.json` when it starts and writes it when it
  ends: result, mode (`full`, `server` or `client`), each step's result, the
  branch and commit, and a fingerprint of the files when the run started. It
  holds no environment values. Never edit it by hand.

## Reusing a run

`scripts/verify.ps1 -ReuseIfCurrent` is the only way to reuse a result. It
prints `Reusing Verify PASS from ...` and the stored step lines only when the
last run was a full PASS, every step passed, and the fingerprint still matches.
Otherwise it prints `Not reusing the last Verify: <reason>` and runs in full.

The fingerprint covers every file git does not ignore, tracked or untracked,
except `blueprint/context/current-feature.md`, `blueprint/context/findings.md`,
`blueprint/history/**` and `blueprint/build-plan.md`. So `/complete`'s own
bookkeeping keeps a result, and any other edit (code, tests, scripts,
`.claude/`, other docs) means a new run. A failed, partial or interrupted run is
never reused. Report a reuse as a reuse, never as a new run.

## After it runs

1. Report one line per step from the summary: PASS, FAIL (with the first real
   error message from the tail or log) or SKIP (and why). A SKIP is not a pass.
   Say whether the result was reused.
2. Check the diff: `git status` and `git diff --stat`. Confirm only files in the
   current spec's scope changed and that none of the files in "Unexpected files"
   below are included.
3. If anything failed or a file is unexpected, do not call the work done. Report
   it as "When something fails or stops" in `blueprint/context/ai-interaction.md`
   says, with the recommended option from the tables below as `Next`.
4. When run on its own, end with the handoff ("Ending a turn"): for example
   `Status: Verification passed (ran fresh).` and the loop's next command.

Never skip, disable or delete a test to make Verify pass.

## Common failures

`/complete` and `/approve` use this table too. "Rerun" means the command that
stopped: `/verify`, `/complete` or `/approve`.

| Failure | Kind | Options (recommended first) |
| --- | --- | --- |
| `FAIL  Docker (not running ...)`, or server tests: "Docker is either not running or misconfigured" | Environment | 1. Start Docker Desktop, wait for "Engine running", rerun (Recommended). 2. Set `VETIFLOW_TEST_POSTGRES` to a local Postgres for this terminal, rerun. |
| Server build: MSB3027, "file is locked by vetiflow.Server" | Environment | 1. Stop the running app (Ctrl+C in its terminal), rerun (Recommended). |
| A test, lint or build error in this work's files | Error | 1. Fix it: while a spec step is in progress Claude fixes it now; otherwise `/ready` and describe it (Recommended when the cause is clear). 2. `/debug` to find the cause first (Recommended when it is not). |
| An error in code this work did not touch | Error | 1. Note it and `/fix "<what>"` on its own branch after this one; continue only if it does not block this work (Recommended). 2. Fix it here as a spec change, when it blocks this work. |
| `FAIL  Workflow tests` | Error | 1. Read the failed check names in the output; fix the guardrail file it names, never weaken the check or the rule (Recommended). 2. `/debug` when the cause is unclear. |

## Unexpected files

| Found | Options (recommended first) |
| --- | --- |
| A secret (`.env`, a connection string, a key) | No choice: remove it from the file now and never commit it. If it was ever pushed, rotate it. Then rerun. |
| Changes from other work | 1. `git stash push -- <files>` and bring them back later with `git stash pop` (Recommended). 2. They belong here: say so, and they are added to the spec's scope. |
| Build output or junk (`bin/`, `obj/`, `coverage/`, `dist/`, logs) | 1. Add the pattern to `.gitignore` (Recommended when it will come back). 2. Delete the files (Claude asks first). |
