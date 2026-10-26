# Fix: Verify evidence and one reuse rule

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/verify-evidence`
- **Audit:** `required` - changes Verify and the Verify gates in `/audit`, `/complete` and `/approve` (workflow safety checks). Per the hardening plan, run it in a separate session the person starts.
- **Fixes:** F-07, F-08 (open P3s from `blueprint/history/fixes/2026-10-25-verify-script-gaps.md`)

## The problem

Slice B of the workflow hardening plan. Verify leaves no record of what it
proved, so each gate decides on its own, in prose, whether an earlier run still
counts:

1. **No evidence.** `scripts/verify.ps1` prints a summary and exits. Nothing
   records which files the run covered, whether it ran in full mode, or whether
   it passed. A later step cannot tell a full PASS from a `-ServerOnly` run, a
   FAIL, or a run from before the last edit.
2. **Three different reuse rules.** `/audit` step 2 reuses "a passing `/verify`
   from this session when no files changed" (judged by memory).
   `/complete` gate 3 never reuses. `/approve` check 3 compares file times with
   `landing-commit.txt` (`.claude/skills/approve/SKILL.md`, check 3), which
   misses deletions and files restored with old timestamps. The result is
   either a redundant 5-10 minute rerun or a reuse that is not proven.
3. **Noisy output.** Every step's full output goes to the console, so the
   summary and the one failing error are buried in thousands of lines of
   build and test output.
4. **Redundant step.** `dotnet tool restore` plus `dotnet ef migrations
   has-pending-model-changes` (`scripts/verify.ps1:88-93`) duplicates
   `MigrationTests.Model_MatchesLatestMigration`
   (`vetiflow.Server.Tests/Data/MigrationTests.cs:18-26`), which already runs in
   Server tests.
5. **Narrow checks miss shared changes.** `/implement` step 3.5 runs only the
   tests a step touched, even when the step changes shared code, a dependency,
   config, security or database code that other tests depend on. The break then
   shows up only in the final Verify.
6. **F-07 [P3]:** the Docker probe (`scripts/verify.ps1:60-66`) treats any
   stderr line from `docker info` as "not running" on Windows PowerShell 5.1,
   because `$ErrorActionPreference = 'Stop'` turns redirected native stderr into
   a terminating error. Reproduce: a Docker Desktop setup that prints a warning
   to stderr; Verify stops with `FAIL  Docker (not running ...)` while the
   engine runs.
7. **F-08 [P3]:** no blank line between the "Common failures" table and
   `## Unexpected files` (`.claude/skills/verify/SKILL.md:63-64`).

## The fix

**Evidence.** Every Verify run deletes `.verify/evidence.json` when it starts
(so an interrupted run leaves none) and writes it when it ends, pass or fail:

```json
{
  "result": "PASS",            // PASS or FAIL
  "mode": "full",              // full, server or client
  "steps": [{ "name": "Server tests", "result": "PASS" }],
  "fingerprint": "<sha256>",   // taken when the run started
  "branch": "fix/verify-evidence",
  "head": "<commit sha>",
  "finishedAt": "<ISO 8601 UTC>",
  "powershell": "5.1.26100"
}
```

**Fingerprint.** A SHA-256 over the sorted `path blob-hash` lines of every file
from `git ls-files --cached --others --exclude-standard` that exists on disk,
using `git hash-object --stdin-paths` (one process, fast, follows git's
line-ending rules). Untracked new files count; deleted files drop out and
change the hash. Excluded, because no Verify step reads them and the workflow
rewrites them after Verify:

- `blueprint/context/current-feature.md`, `blueprint/context/findings.md`
- `blueprint/history/**`
- `blueprint/build-plan.md` (`/complete` ticks it after its Verify)

Everything else counts, including `scripts/**`, `.claude/**`, `.config/**`,
`.github/**`, `package*.json` and the other `blueprint/context/` guidance files.
Git-ignored files (`bin/`, `obj/`, `node_modules/`, `.verify/`, landing drafts)
never count.

**One reuse rule.** New switch `scripts/verify.ps1 -ReuseIfCurrent`. It prints
`Reusing Verify PASS from <finishedAt> (<branch> @ <short head>)` and the stored
step lines, then exits 0, only when all of these hold; otherwise it says which
one failed (`no evidence`, `last run failed`, `last run was server-only`,
`a step did not pass`, `files changed since`) and runs full Verify:

- the evidence file exists and parses;
- `result` is `PASS`, `mode` is `full`, and every step is `PASS`;
- its `fingerprint` equals the current fingerprint.

`-ReuseIfCurrent` cannot be combined with `-ServerOnly` or `-ClientOnly`.
`/audit` step 2, `/complete` gate 3 and `/approve` check 3 all use it, with the
same wording. `/verify` and `/implement` step 5 always run fresh. A reuse is
reported as a reuse, never as a new run.

**Quiet output.** Each step writes its full output to
`.verify/logs/<step-name>.log` (overwritten per run). The console shows one
`==> <step>` line per step, then the summary. When a step fails, the console
also shows the last 60 lines of its log and the log path. The `.verify/`
folder is added to `.gitignore`. Under Windows PowerShell 5.1 the step body
runs with `$ErrorActionPreference = 'Continue'` while redirected, so native
stderr is logged rather than thrown, and `$LASTEXITCODE` stays the only
pass/fail signal.

**Drop the ef step.** Remove `Tool restore` and `No pending model changes` from
Verify. Keep the `dotnet-ef` pin in `.config/dotnet-tools.json`; `/migration`
step 1 gains `dotnet tool restore` before its manual ef commands. `/audit`'s
data lens checks that `Model_MatchesLatestMigration` passed instead.

**Broader narrow checks.** `/implement` step 3.5: when a step changes shared
code (used by more than one feature), a dependency (`*.csproj`,
`package.json`, `package-lock.json`, `.config/dotnet-tools.json`), config
(`Program.cs`, `appsettings*.json`, `vite.config.ts`, `tsconfig*.json`),
security (sign-in, roles, owner scope, redaction) or database code
(`Data/`, entities, migrations), run the whole affected suite
(`dotnet test --project vetiflow.Server.Tests`, or `npm run test -- --run`)
instead of a filter.

**F-07:** run the probe as `docker info --format '{{.ServerVersion}}'` with
`$ErrorActionPreference = 'Continue'` inside the probe, output discarded, and
`$LASTEXITCODE` as the only signal. **F-08:** add the blank line.

**Must not break:**

- Verify still stops at the first failure, exits 1 on any failure and 0 only
  when every step passed, and works in both Windows PowerShell 5.1 and `pwsh`.
- Workflow tests still run first in every mode.
- No `.env` reads and no secret values in evidence or logs. The evidence file
  holds no environment values; logs hold only what the console showed before.
- CI is unaffected (it does not run `verify.ps1` until slice C, and slice C
  must never read local evidence).

## Build steps

- [x] **Step 1 - failing tests.** Add `scripts/tests/verify-evidence.tests.ps1`
  in the style of `secret-guardrails.tests.ps1` (plain PowerShell,
  `Assert-True`, fixtures in a temp git repo under `TEMP`, never the real
  repo's evidence). It dot-sources `scripts/verify-evidence.ps1` (does not exist
  yet) and checks:
  - the fingerprint is stable across two calls;
  - editing an excluded file (`blueprint/context/findings.md`,
    `blueprint/history/x.md`, `blueprint/build-plan.md`) leaves it unchanged;
  - editing a tracked file, adding an untracked file, deleting a tracked file,
    or editing `scripts/verify.ps1` changes it;
  - a git-ignored file does not change it;
  - the reuse decision returns reuse only for a full PASS with all steps PASS
    and a matching fingerprint, and returns the right reason for: missing file,
    unparsable file, FAIL, `server` mode, `client` mode, a SKIP step, and a
    fingerprint mismatch.

  *Done when:* running the test file directly fails because
  `scripts/verify-evidence.ps1` is missing.

- [x] **Step 2 - evidence functions.** Add `scripts/verify-evidence.ps1` with
  `Get-VerifyFingerprint -RepoRoot`, `Write-VerifyEvidence`,
  `Remove-VerifyEvidence` and `Test-VerifyEvidence` (returns
  `{ Reusable, Reason, Evidence }`). Add `.verify/` to `.gitignore`.
  *Done when:* `verify-evidence.tests.ps1` passes in Windows PowerShell 5.1.

- [x] **Step 3 - Verify script.** In `scripts/verify.ps1`: dot-source the
  functions; delete evidence at start and take the fingerprint; write evidence
  on every exit path (including `Stop-Verify` and the Docker stop); add
  `-ReuseIfCurrent` (rejects the other switches); log each step to
  `.verify/logs/`, show the failing log's tail; remove `Tool restore` and
  `No pending model changes`; fix the Docker probe (F-07). Update the help block.
  *Done when:* a full run passes and writes a `PASS`/`full` evidence file; a
  second run with `-ReuseIfCurrent` reuses it in seconds; after editing any
  non-excluded file `-ReuseIfCurrent` reports `files changed since` and runs in
  full; a `-ClientOnly` run is not reused; the console shows only step lines and
  the summary on success.

- [x] **Step 4 - skills and docs.**
  - `/verify` skill: new "What it runs" list (no ef step), evidence and logs,
    `-ReuseIfCurrent`, reading a failure from the log; remove the "Tool restore
    fails" row; F-08 blank line.
  - `/audit` step 2, `/complete` gate 3, `/approve` check 3: the one reuse rule
    (`verify.ps1 -ReuseIfCurrent`), same wording; drop the timestamp rule from
    `/approve`. `/audit` data lens: `Model_MatchesLatestMigration` instead of
    `has-pending-model-changes`.
  - `/implement` step 3.5: broader suite for shared, dependency, config,
    security or database changes.
  - `/migration` step 1: `dotnet tool restore` first.
  - `ai-interaction.md` loop section: one sentence on evidence and reuse.

  *Done when:* `grep` finds no remaining mention of Verify running
  `has-pending-model-changes`, and the three gates use identical reuse wording.

- [x] **Step 5 - repair F-26: a command that cannot start must never pass.**
  Move the logged run out of `Invoke-Step` into
  `Invoke-VerifyCommand -Command -LogPath` in `scripts/verify-evidence.ps1`
  (dot-sourceable by the tests); it returns the exit code. Set
  `$global:LASTEXITCODE` to `-1` (not `0`) before running the step. Inside
  `verify.ps1`'s `try` block PowerShell already throws on a missing command (the
  run stops with no evidence); the sentinel keeps that true if the call ever
  runs outside a `try`. `Invoke-Step` keeps its console lines, log tail and
  `Stop-Verify` and calls the new function. Tests in
  `verify-evidence.tests.ps1` (temp log path, never `.verify/`): a missing
  command never returns 0, inside a `try` and in a child process outside one,
  and its error text is in the log; `cmd /c exit 3` returns 3; a native command
  that writes to stderr and exits 0 returns 0 (F-07 stays fixed).
  *Done when:* the outside-`try` test fails with the old `0` sentinel and passes
  with `-1` in Windows PowerShell 5.1, and a full Verify passes.

## Scope change: `/ready`, a bounded repair-and-review loop

Added on the person's instruction ("fix it all in this branch"). This is the
core of hardening slice E (`feature/run-item`), built here instead of on its own
branch. The person's input stays at spec approval, exceptions and publication;
routine repair and re-review no longer need a relay through them.

**`/ready`** (new skill, started only by the person, `disable-model-invocation:
true`) takes an `approved`, `in progress` or `verified` spec to "ready for
`/complete`" and stops there. It never runs `/complete` or `/approve`.

1. **Build:** follow `/implement` sections 2-5 for any unticked steps.
2. **Review, round 1:** a full `/audit` in a fresh subagent (a new
   general-purpose agent, never a fork of this session, so the reviewer did not
   write the code). The agent follows `.claude/skills/audit/SKILL.md`, writes
   `findings.md` and returns its summary.
3. **Repair:** for each blocking finding, add a repair step to the spec without
   asking, build it per `/implement` section 3 (failing test first), mark it
   `fixed`, then run `/verify`.
4. **Review, rounds 2 and 3:** a focused `/audit` in a new subagent: the paths
   changed since the last review, their callers, regressions, and every `open`
   or `fixed` finding. When a focused round finds no blocker, one last full
   review of the combined change runs. A blocker it finds starts the next
   round, if one is left.
5. **Prove it:** when a *Done when* needs the running app, run `/check`.
6. **Report** in the compact form below, then say what to type next.

**Blocking:** P0 and P1. A P2 blocks only when its Problem names the *Done
when* or hard rule it breaks. Other P2 and P3 findings stay listed as
follow-ups; `/ready` never marks one `accepted`.

**Continues on its own:** repairs needed to meet the approved spec, regression
tests for found defects, re-checking repairs, running affected tests and
reusing current Verify evidence, recording unrelated ideas as follow-ups.

**Stops and asks:** a product choice or ambiguous requirement; a scope or
architecture change; accepting a risk or skipping a required check; a secret
restriction, the hook, or an external setup problem (Docker, network, app will
not start); the same failure after two repair attempts; no blocker closed in a
round; the round limit (3) reached; anything that commits, pushes, merges or
deploys. At a stop it lists the remaining blockers. Never weaken or skip a
test, and never change a severity, to finish. Only the reviewer may lower a
severity, with its evidence written in the finding, and `/ready` reports it.

**Report:**

```
Round 2/3: repaired F-26
Checks: affected tests passed; full Verify reused
Review: blocker confirmed closed
Remaining: one non-blocking follow-up (F-27 P3)
State: ready for /complete
```

**Independent review.** A fresh subagent counts as the separate reviewer for
routine work. Work that the hardening plan reserves for a person-started
session (phase S or 8, migrations or stored data, a hard rule, or a workflow
skill's safety checks) still needs one full `/audit` in a session the person
starts after `/ready` ends. The `Audit run` line records the reviewer kind
(`session` or `subagent`), and `/complete` gate 5 requires a `session` line for
that work. The line is written by the reviewer, so this rule is advisory, not
enforced.

**Kept:** `disable-model-invocation: true` stays on every workflow skill.
`/ready` follows the other skills by reading their files, so Claude still cannot
start `/complete`, `/approve` or `/feature` on its own. A workflow test pins the
flag on `/ready`, `/complete` and `/approve`.

- [x] **Step 6 - `/ready` skill.** Add `.claude/skills/ready/SKILL.md` with the
  stages, blocking rule, continue/stop lists, round limit, report format and
  independent-review rule above. It links to the other skills instead of
  copying them.
  *Done when:* the skill covers each item in this section, and nothing in it
  commits, pushes, merges, accepts a finding or skips a check.

- [x] **Step 7 - `/audit` for the loop.** Add a `focused` input (changed paths
  since the last review, callers, regressions, outstanding findings). The
  `Audit run` line gains the reviewer kind and the mode:
  `Audit run <date> on <branch> (<session|subagent>, <full|focused>): ...`.
  When run by `/ready`, return the summary (findings, blockers, any severity
  lowered with evidence) instead of offering next steps. The reviewer may lower
  a severity only with evidence written into the finding.
  *Done when:* `/audit` documents both modes, the new line and the `/ready`
  return format.

- [x] **Step 8 - wiring and docs.** `ai-interaction.md`: `/ready` in the loop,
  the independent-review rule beside "When to audit", and a note that `/ready`
  adds repair steps without asking. `/implement` section 6: `/ready` offered as
  an option. `/complete` gate 5: the `session` line rule. `/status`: rows for
  `/ready`. `CLAUDE.md`: `/ready` in the loop line and the command table.
  *Done when:* each of those files mentions `/ready` consistently and the
  manual loop (`/implement`, `/clear`, `/audit`) still works unchanged.

- [x] **Step 9 - guard test.** Add `scripts/tests/skill-guards.tests.ps1`
  (plain PowerShell, like the other workflow tests) that fails unless
  `ready`, `complete` and `approve` keep `disable-model-invocation: true` in
  their frontmatter.
  *Done when:* the test passes, fails when the flag is removed from a copy of
  one skill, and a full Verify passes.

- [x] **Step 10 - repair F-27: `/ready` always checks the branch.** In
  `.claude/skills/ready/SKILL.md` section 1, apply `/implement` section 2's
  branch check (the exact `**Branch:**`, never `main`, the "Unexpected files"
  stop) before building or repairing, even when every step is ticked and there
  is nothing to build. Only the status change to `in progress` waits for real
  work.
  *Done when:* `/ready` section 1 runs the branch check on every path,
  including a `verified` spec, and the skill-guards and full Verify still pass.

- [x] **Step 11 - repair F-29: restore the ef tool before manual ef commands.**
  In `CLAUDE.md`'s Commands section, add `dotnet tool restore` (with a comment
  that it installs the pinned `dotnet-ef`) as the first line of the Migrations
  block. In `.claude/skills/debug/SKILL.md:28`, note that `dotnet tool restore`
  runs first. `blueprint/context/coding-standards.md:42` only states the rule
  and stays unchanged.
  *Done when:* every place outside `/migration` that tells you to run
  `dotnet ef` comes with `dotnet tool restore` before it or points to where it
  does, and a full Verify passes.

## Verify

- `scripts/tests/verify-evidence.tests.ps1` (runs inside Verify's Workflow tests).
- Full `scripts/verify.ps1` in Windows PowerShell 5.1 passes (`pwsh` is not
  installed on this machine; say so in the Result).
- Observe by hand: full run, then `-ReuseIfCurrent` reuses; touch a file under
  `vetiflow.client/src`, `-ReuseIfCurrent` reruns; edit
  `blueprint/context/findings.md` only, `-ReuseIfCurrent` still reuses;
  `-ServerOnly` then `-ReuseIfCurrent` reruns in full; a deliberately failing
  client lint shows only that step's log tail and writes `FAIL` evidence.

## Findings

Three `/audit` runs on 2026-10-25: two full session audits and one before the
`/ready` scope was added. F-26 was lowered from P1 to P3 on re-check and
repaired (Step 5); F-27 and F-29 were repaired (Steps 10 and 11). All three are
closed. F-28, F-30 and F-31 are P3 and left open (repair later with `/fix F-30`
and so on). F-07 and F-08 from the previous fix are repaired here.

### F-26 [P3] closed - A command that cannot start could count as a pass
**Where:** `scripts/verify.ps1:90` (`Invoke-Step`)
**Problem:** `Invoke-Step` set `$global:LASTEXITCODE = 0` and ran the step with
`$ErrorActionPreference = 'Continue'`. Called outside a `try` block, a missing
command (for example `npm` not found) only logs an error and leaves the 0, so the
step passes. Lowered from P1 on re-check: every step in `verify.ps1` runs inside
`try`/`finally`, where Windows PowerShell 5.1 throws on a missing command, so the
real run stops with exit 1 and writes no evidence (reproduced with copies of both
`main`'s and this branch's script with `npm run lint` swapped for a missing
command). The guarantee rested on that rule alone, with no test.
**Fix:** `Invoke-VerifyCommand` in `scripts/verify-evidence.ps1` starts from a `-1`
exit code; workflow tests check that a missing command never passes inside and
outside a `try`.
**Re-check (2026-10-25):** closed. `Invoke-VerifyCommand` starts from `-1`
(`scripts/verify-evidence.ps1:29`), `Invoke-Step` calls it, and
`verify-evidence.tests.ps1` passed in Windows PowerShell 5.1 when run directly
(37 checks, including the missing-command cases inside and outside a `try`).

Audit run 2026-10-25 on `fix/verify-evidence`: 1 new findings, 0 closed.

### F-27 [P3] closed - `/ready` can repair without the branch check
**Where:** `.claude/skills/ready/SKILL.md` section 1 ("Skip when every step is ticked and the spec is `verified`")
**Problem:** the "never build on `main`" and unrelated-changes check lives in
`/implement` section 2, which `/ready` only enters when there are unticked
steps. With a `verified` spec, `/ready` goes straight to review and section 3
repairs, so a spec carried to `main` by `git switch` with uncommitted changes
would be repaired on `main`. `/complete` gate 2 catches it later and nothing is
committed, so the harm is limited.
**Fix:** in `/ready` section 1, always apply `/implement` section 2's branch
check (exact `**Branch:**`, never `main`, unexpected files) before building or
repairing, even when there is nothing to build.
**Re-check (2026-10-25):** closed. `/ready` section 1 now opens with "First,
every time, apply the branch check from `.claude/skills/implement/SKILL.md`
section 2 ... even when there is nothing to build"; only the `Status` change
waits for real work.

### F-28 [P3] open - Workflow tests assume Windows, ahead of slice C's Linux CI
**Where:** `scripts/tests/verify-evidence.tests.ps1` (the `cmd /c exit 3` and `cmd /c 'echo step warning 1>&2 & exit 0'` checks)
**Problem:** `.github/workflows/ci.yml` runs on `ubuntu-latest`. Slice C will
run `verify.ps1` there under `pwsh`, and every mode runs the workflow tests
first, so these checks fail with `cmd` not found. CI does not run Verify yet,
so nothing breaks on this branch.
**Fix:** when slice C lands, run the native-command checks through a portable
command (for example the current PowerShell executable with `-Command "exit 3"`
and `[Console]::Error.WriteLine(...)`), or pick `cmd` or `sh` by platform.

### F-29 [P3] closed - Manual `dotnet ef` commands no longer have the tool restored
**Where:** `.claude/skills/debug/SKILL.md:28`, `CLAUDE.md:81`, `blueprint/context/coding-standards.md:42`
**Problem:** Verify used to run `dotnet tool restore` on every run, so
`dotnet ef ...` always worked. Only `/migration` step 1 now says to restore
first. In a fresh clone, the `has-pending-model-changes` command that `/debug`
and `CLAUDE.md` suggest fails with "dotnet-ef not found".
**Fix:** add `dotnet tool restore` before the ef lines in `CLAUDE.md`'s
Commands section, and a pointer to it in `/debug`.
**Re-check (2026-10-25):** closed. `CLAUDE.md:80` runs `dotnet tool restore`
first in the Migrations block, `/debug` line 28 names it, and `/migration` step 1
has it. A grep finds no other instruction to run `dotnet ef` without it
(`coding-standards.md:42` states the rule only, as the spec decided).

Audit run 2026-10-25 on `fix/verify-evidence` (session, full): 3 new findings, 1 closed.

### F-30 [P3] open - Reuse cannot see git-ignored inputs the checks read
**Where:** `scripts/verify-evidence.ps1` (`Get-VerifyFingerprint`, `--exclude-standard`); `.claude/skills/verify/SKILL.md` "Reusing a run"
**Problem:** the client build and tests read `import.meta.env.VITE_API_BASE_URL`
(`vetiflow.client/src/services/casesApi.ts:6`, `src/test/server.ts:5`), which
Vite takes from git-ignored `.env*` / `*.local` files or the environment.
Server tests depend on `VETIFLOW_TEST_POSTGRES`, and every step on the SDK and
Node versions. None of these are in the fingerprint, so after changing one,
`/complete` gate 3 and `/approve` check 3 reuse a PASS the new setup never
earned. The `/verify` skill says "any other edit ... means a new run", which
reads as covering them. Hashing `.env` files would break the secret rule, so
the spec's choice to ignore them stands.
**Fix:** in "Reusing a run", say that reuse sees only files git does not ignore,
and that after changing local env files, environment variables or tool versions
you run `/verify` (fresh) instead.

### F-31 [P3] open - History Result template has no way to say Verify was reused
**Where:** `.claude/skills/complete/reference/result-template.md` (`- **Verify:** \`scripts/verify.ps1\` on <YYYY-MM-DD>`)
**Problem:** `/complete` gate 3 now usually reuses the evidence, but the
template reads as a run on that date. The spec's rule is "a reuse is reported
as a reuse, never as a new run", and the history file is the lasting record.
**Fix:** change the line to `scripts/verify.ps1 on <YYYY-MM-DD>` with
`(reused from <finishedAt>, <branch> @ <short head>)` when gate 3 reused it.

Audit run 2026-10-25 on `fix/verify-evidence` (session, full): 2 new findings, 2 closed.

## Result

- **Shipped:** branch `fix/verify-evidence`, squash-merged to `main` (the commit subject carries the PR number)
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` on 2026-10-25 (Windows PowerShell 5.1; `pwsh` is not installed on this machine), reused from the full run finished 2026-10-26T01:05:31Z UTC (`fix/verify-evidence @ 9d1bfe4`)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** not run as `/check` (no running-app behaviour). Observed during the audit and `/complete`: `-ReuseIfCurrent` reused the full PASS, and still reused it after `blueprint/context/findings.md` was edited. The other hand checks in the spec's Verify section (client file touched, `-ServerOnly` then reuse, a failing lint) were not recorded in these sessions.
- **Audit:** required (changes Verify and the Verify gates in `/audit`, `/complete` and `/approve`). Final full session audit after the last change: F-27 and F-29 closed, F-30 and F-31 [P3] opened; F-28 [P3] still open. F-26 closed earlier.
- **Follow-ups added to build plan:** none (F-28, F-30 and F-31 go through `/fix`; F-28 matters when slice C runs Verify on Linux CI).
- **Deploy notes:** none. Verify no longer runs `dotnet tool restore`; run it by hand before manual `dotnet ef` commands (`CLAUDE.md` Commands, `/migration` step 1).
