---
name: verify
description: Run scripts/verify.ps1 (server build and tests, migration check, client lint, build and tests) and report the real results. Use for /verify, before saying a change is done, and before /complete.
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
only `vetiflow.client/` changed. `/implement`, `/complete` and `/approve` always
run it with no option.

## What it runs

1. Workflow tests: every `scripts/tests/*.tests.ps1` (today the secret
   guardrails: the hook, `db-target.ps1`, `.claude/settings.json` and
   `.dockerignore`). Runs in every mode.
2. Docker check: unless `VETIFLOW_TEST_POSTGRES` is set, stops with
   `FAIL  Docker` when Docker is not running.
3. Server build (through the test project). If it fails while `vetiflow.Server`
   is running, it prints a hint that the app locks its exe (MSB3027).
4. Server tests: `dotnet test --project vetiflow.Server.Tests`. Needs Docker for
   Testcontainers, or `VETIFLOW_TEST_POSTGRES`.
5. `dotnet tool restore` (`dotnet-ef` is pinned in `.config/dotnet-tools.json`),
   then `dotnet ef migrations has-pending-model-changes`. Always runs; never
   skipped.
6. Client: `npm ci` when `node_modules/.package-lock.json` is missing or older
   than `package-lock.json`, then lint, build, and `npm run test -- --run`.

## After it runs

1. Report one line per step from the summary: PASS, FAIL (with the first real
   error message) or SKIP (and why). A SKIP is not a pass.
2. Check the diff: `git status` and `git diff --stat`. Confirm only files in the
   current spec's scope changed and that none of the files in "Unexpected files"
   below are included.
3. If anything failed or a file is unexpected, do not call the work done. Report
   it as "When something fails or stops" in `blueprint/context/ai-interaction.md`
   says, offering the options from the tables below as a selection when there is
   more than one.

Never skip, disable or delete a test to make Verify pass.

## Common failures

`/complete` and `/approve` use this table too. "Rerun" means the command that
stopped: `/verify`, `/complete` or `/approve`.

| Failure | Kind | Options (recommended first) |
| --- | --- | --- |
| `FAIL  Docker (not running ...)`, or server tests: "Docker is either not running or misconfigured" | Environment | 1. Start Docker Desktop, wait for "Engine running", rerun (Recommended). 2. Set `VETIFLOW_TEST_POSTGRES` to a local Postgres for this terminal, rerun. |
| Server build: MSB3027, "file is locked by vetiflow.Server" | Environment | 1. Stop the running app (Ctrl+C in its terminal), rerun (Recommended). |
| A test, lint or build error in this work's files | Error | 1. Fix it: while a spec step is in progress Claude fixes it now; otherwise `/implement` and describe it (Recommended when the cause is clear). 2. `/debug` to find the cause first (Recommended when it is not). |
| An error in code this work did not touch | Error | 1. Note it and `/fix "<what>"` on its own branch after this one; continue only if it does not block this work (Recommended). 2. Fix it here as a spec change, when it blocks this work. |
| `FAIL  Workflow tests` | Error | 1. Read the failed check names in the output; fix the guardrail file it names, never weaken the check or the rule (Recommended). 2. `/debug` when the cause is unclear. |
| Tool restore fails | Environment | 1. Check the network and the NuGet feed, then rerun (Recommended). 2. `dotnet tool restore` by hand to see the full error. |
## Unexpected files

| Found | Options (recommended first) |
| --- | --- |
| A secret (`.env`, a connection string, a key) | No choice: remove it from the file now and never commit it. If it was ever pushed, rotate it. Then rerun. |
| Changes from other work | 1. `git stash push -- <files>` and bring them back later with `git stash pop` (Recommended). 2. They belong here: say so, and they are added to the spec's scope. |
| Build output or junk (`bin/`, `obj/`, `coverage/`, `dist/`, logs) | 1. Add the pattern to `.gitignore` (Recommended when it will come back). 2. Delete the files (Claude asks first). |
