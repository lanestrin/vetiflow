# Fix: Verify runs only the checks the changed files need

**Type:** Fix
**Status:** complete
**Branch:** `fix/verify-runs-only-what-changed`
**Audit:** not needed - Verify scripts, their workflow tests and skill docs only; no application code.

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

`scripts/verify.ps1` runs every step on every run, whatever changed. A local
full run takes about 5½ minutes (measured 2026-10-28 on
`feature/board-summary-api`): workflow tests ~1m 10s, server build and tests
~3m 20s, client lint, build and tests ~1 min.

- **Changes that touch only workflow files run everything.** A branch that
  touches only `.claude/`, `blueprint/` or `scripts/` still runs the server and
  client suites, which can't be affected. PRs #80 and #81 were like this.
- **Single-side changes run both sides.** A client-only change still runs the
  ~3-minute server suite. `-ServerOnly` and `-ClientOnly` exist
  (`scripts/verify.ps1:27-28`), but `/implement` and `/verify` must run with no
  option (`.claude/skills/verify/SKILL.md:20-22`), and reuse accepts only a
  full PASS (`scripts/verify-evidence.ps1:122-124`), so a scoped run would
  only be repeated in full at `/complete`.

To reproduce: on a branch that changes only a `.claude/skills/*/SKILL.md`,
run `scripts/verify.ps1`. The summary lists Server build, Server tests, Client
lint, Client build and Client tests, all run.

## The fix

Verify works out which checks the branch needs from the files changed since it
left `main`, runs only those, and records the scope so later gates can reuse
the result.

**Scope rule** (new `scripts/verify-scope.ps1`, dot-sourced like
`verify-evidence.ps1`):

- Changed files: `git diff --name-only <base>` (committed, staged and
  unstaged, deletions included) plus untracked files git does not ignore.
  `<base>` is `git merge-base HEAD origin/main`, or `main` when there is no
  `origin/main`.
- Each path falls into one group:
  - **client:** `vetiflow.client/**`
  - **server:** `vetiflow.Server/**`, `vetiflow.Server.Tests/**`
  - **workflow:** `.claude/**`, `blueprint/**`, `.github/**`, `scripts/**`
    and root `*.md`, except `scripts/verify.ps1`, `scripts/verify-evidence.ps1`
    (its `Invoke-VerifyCommand` runs every step; added while building) and
    `scripts/verify-scope.ps1`, which change how the steps run, so they count
    as **full**
  - **full:** anything else (solution file, `global.json`,
    `.config/dotnet-tools.json`, root config, the `Dockerfile`, a new top
    folder). Unknown paths always mean full.
- The scope is the smallest one that covers every group: `workflow` (only
  workflow files, or nothing changed), `server`, `client`, or `full` (server
  and client, any full path, or no base found).

**`verify.ps1`:**

- With no option, it computes the scope and runs workflow tests always, then
  the server steps (Docker check, build, tests) for `server` or `full`, and
  the client steps for `client` or `full`.
- It prints the scope and why before the first step, for example
  `Scope: client (7 changed files, all under vetiflow.client/)`. Steps it
  leaves out are named once in the summary as not needed, for example
  `Not needed: server steps (no server files changed)`. They are not recorded
  as SKIP, because a SKIP still stops `/complete` and `/approve`.
- New `-Full` runs every step whatever changed. `-ServerOnly` and `-ClientOnly`
  stay exactly as they are, because CI's two jobs use them.
- Evidence records the mode (`workflow`, `server`, `client` or `full`) and the
  changed-file groups.

**Reuse** (`Test-VerifyEvidence`): `-ReuseIfCurrent` reuses a PASS when the
fingerprint still matches and its mode covers the scope needed now (`full`
covers everything, `server` covers `server` and `workflow`, `client` covers
`client` and `workflow`, `workflow` covers only `workflow`). Otherwise it says
why and runs the needed scope, not a full run. `-ReuseIfCurrent` with `-Full`
reuses only a full PASS.

**It must not break:**

- CI keeps running every check on every PR and on `main`. `ci.yml` is
  unchanged, and its explicit modes never auto-scope.
- The fingerprint, the bookkeeping exclusions and the "interrupted or failed
  runs are never reused" rule stay as they are.
- A change Verify can't classify always runs in full. The rule may only narrow
  for paths it knows.
- Never weaken a gate: `/complete` and `/approve` still stop on any FAIL or
  SKIP.

## Out of scope

- Selecting single tests inside a suite (only whole sides are skipped).
- Making the server tests themselves faster (Testcontainers start-up).
- Changing CI.

## Build steps

- [x] **Step 1 - failing tests for the scope rule.** New
  `scripts/tests/verify-scope.tests.ps1`, in the style of
  `verify-evidence.tests.ps1`: a throwaway git repo in TEMP with a `main`
  branch and a work branch. *Done when:* it fails because
  `scripts/verify-scope.ps1` doesn't exist yet, and it covers:
  - only `.claude/` or `blueprint/` changed → `workflow`;
  - nothing changed → `workflow`;
  - only `vetiflow.client/` changed, an untracked file included → `client`;
  - only `vetiflow.Server/` or `vetiflow.Server.Tests/` changed → `server`;
  - a deleted server file → `server`;
  - client and server changed → `full`;
  - `scripts/verify.ps1` changed → `full`;
  - an unknown root file (`global.json`) → `full`;
  - no `origin/main` and no `main` → `full`;
  - uncommitted (staged and unstaged) changes count, not only commits.
- [x] **Step 2 - scope rule.** Add `scripts/verify-scope.ps1` with
  `Get-VerifyScope -RepoRoot` returning the scope, the reason line and the
  groups found. *Done when:* `verify-scope.tests.ps1` passes.
- [x] **Step 3 - Verify uses the scope, and reuse accepts covering modes.**
  `verify.ps1` runs by scope, prints the scope line and the "Not needed" line,
  and adds `-Full`. `Test-VerifyEvidence` takes the needed scope.
  `verify-evidence.tests.ps1` gains or changes cases. *Done when:*
  - a `server` PASS is reused for a `server` or `workflow` need and not for
    `client` or `full`, and the same the other way for `client`;
  - a `workflow` PASS is reused only for `workflow`;
  - a `full` PASS is reused for any need;
  - a failed run or a changed fingerprint is still never reused;
  - with `-Full`, only a full PASS is reused;
  - `ci-workflow.tests.ps1` still passes unchanged;
  - in this worktree, `scripts/verify.ps1` prints `Scope: full` (this branch
    changes `verify.ps1`) and runs every step.
- [x] **Step 4 - docs.** Update `.claude/skills/verify/SKILL.md` (Run,
  options, what it runs, reuse, reporting the scope), `/implement` section 5,
  `/ready` section 2, `/complete` and `/approve` gate 3, and `/audit` where
  they describe the run. Also the result template's Verify line (it adds the
  scope), "`/verify` runs inside steps 2 and 5" in
  `blueprint/context/ai-interaction.md`, and `CLAUDE.md` Commands (`-Full`).
  The reports say the scope and whether the result was reused. *Done when:*
  `skill-guards.tests.ps1` passes, and a search for `verify.ps1` across
  `.claude/` and `blueprint/context/` finds no line that still says every run
  is full.

## Files / areas

- New: `scripts/verify-scope.ps1`, `scripts/tests/verify-scope.tests.ps1`.
- Changed: `scripts/verify.ps1`, `scripts/verify-evidence.ps1`,
  `scripts/tests/verify-evidence.tests.ps1`, the skills listed in step 4,
  `.claude/skills/complete/reference/result-template.md`,
  `blueprint/context/ai-interaction.md`, `CLAUDE.md`.
- Not changed: `.github/workflows/ci.yml`, any application code.

## Verify

- Workflow tests: `verify-scope.tests.ps1` and `verify-evidence.tests.ps1`
  pass, and `ci-workflow.tests.ps1` still passes.
- This branch's own Verify is `Scope: full`, because it changes `verify.ps1`,
  so every step runs once.
- Observe by hand in a throwaway worktree off this branch: change only a skill
  file, and `verify.ps1` prints `Scope: workflow`, runs only the workflow
  tests (about a minute instead of 5½), and an immediate
  `verify.ps1 -ReuseIfCurrent` prints `Reusing Verify PASS`. Then touch a
  client file, and `-ReuseIfCurrent` says why it isn't reusing and runs
  `Scope: client`.
- CI on the PR runs both jobs in full as before.

## Result

- **Prepared:** branch `fix/verify-runs-only-what-changed`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-29, scope full (reused from 2026-10-29T15:59:28Z, fix/verify-runs-only-what-changed @ 599f6d6; run in full after the last code change, scope full because the branch changes `verify.ps1`)
  - PASS Workflow tests
  - PASS Server build
  - PASS Server tests (328)
  - PASS Client install
  - PASS Client lint
  - PASS Client build
  - PASS Client tests (397)
- **Check:** no running app involved. `verify-scope.tests.ps1` failed before `scripts/verify-scope.ps1` existed and passes (24 checks); `verify-evidence.tests.ps1` passes (59), `ci-workflow.tests.ps1` (28) and `skill-guards.tests.ps1` (6) pass unchanged. Hand check in a throwaway clone with this branch as `main`: a skill-only change printed `Scope: workflow`, ran only the workflow tests and listed server and client steps as `Not needed` (1m 45s, against about 5½ minutes before); an immediate `-ReuseIfCurrent` reused it; after touching a client file, `-ReuseIfCurrent` printed `Not reusing the last Verify: last run was scope workflow, this needs client` and ran `Scope: client`, all client steps PASS (3m 13s including a first `npm ci`). Conflicting flags (`-Full -ServerOnly`, `-ReuseIfCurrent -ClientOnly`) exit 1 before any step.
- **Audit:** not needed (Verify scripts, workflow tests and skill docs only).
- **Follow-ups added to build plan:** none
- **Deploy notes:** none (workflow files only).
