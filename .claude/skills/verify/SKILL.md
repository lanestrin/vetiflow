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
only `vetiflow.client/` changed. Before `/complete`, always run it with no option.

## What it runs

1. Server build (through the test project).
2. Server tests: `dotnet test --project vetiflow.Server.Tests`. Needs Docker for
   Testcontainers, or `VETIFLOW_TEST_POSTGRES`.
3. `dotnet ef migrations has-pending-model-changes` (skipped with a note if
   `dotnet-ef` is not installed).
4. Client: `npm ci` if `node_modules` is missing, then lint, build, and
   `npm run test -- --run`.

## After it runs

1. Report one line per step from the summary: PASS, FAIL (with the first real
   error message) or SKIP (and why).
2. If the server tests fail because Docker is not running, say so plainly. That
   is an environment problem, not a passing run.
3. Check the diff: `git status` and `git diff --stat`. Confirm only files in the
   current spec's scope changed and that no secrets, connection strings, `.env`
   files, `bin/`, `obj/` or `coverage/` output are included.
4. If anything failed, do not call the work done. Propose the fix, or hand off
   to `/debug` if the cause is unclear.

Never skip, disable or delete a test to make Verify pass.
