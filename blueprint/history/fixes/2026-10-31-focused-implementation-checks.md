# Fix: Focus implementation checks and defer redundant suites

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/focused-implementation-checks`
- **Audit:** not needed - workflow instructions and regression tests only.
- **Approval:** user explicitly requested implementation, regression tests and review without commit or push.

## The problem

`/implement` requires a whole affected suite on every shared-code, dependency,
configuration, security or database step; only the last step can defer it to
Verify. Ordinary multi-step changes can repeat suites before final verification.

## The fix

Use focused checks for individual steps and final affected Verify after all
implementation and repairs. Retain mandatory intermediate checks for database
migrations, authorization, security, clinical-data integrity and explicit spec
requirements. Keep current evidence reuse, approval gates and safety protections.
Do not change production verification scripts, add caching, scanners, agents or
new layers. The user also authorized optimizing PR-title tests after profiling:
retain every rule case in-process and representative fresh-process CLI coverage.

## Build steps

- [x] **Step 1 - regressions.** Extend workflow instruction guards to catch
  repeated ordinary full suites and preserve sensitive intermediate checks,
  final Verify ownership and evidence reuse. Observe failure before the edits.
- [x] **Step 2 - workflow.** Minimally update `/implement`, `/ready` and
  `ai-interaction.md`; run relevant workflow regressions and final scoped Verify.
  *Done when:* ordinary steps use focused checks, sensitive checks remain
  mandatory, final affected testing and evidence integrity are unchanged, and
  tests pass. Stop for review; do not commit or push.
- [x] **Step 3 - PR-title test startup.** Invoke the unchanged title checker
  in-process for all existing rule cases; retain fresh-process CLI success and
  failure coverage, including output and exit codes. Measure before/after with
  the same runner and rerun scoped Verify. Stop for review without commit or push.

## Verify

Run `scripts/tests/skill-guards.tests.ps1`, `git diff --check` and
`scripts/verify.ps1` (scope determined by the unchanged script). Walk through
ordinary multi-step work, sensitive changes, repairs and completion/approval reuse.

## Verification results

- Skill guards: observed 7 failures against the previous instructions, then
  all 20 checks passed after the edits.
- Fresh `scripts/verify.ps1`: PASS, scope workflow; all seven workflow test
  files passed (477 checks). Server/client steps not needed for this diff.
- `git diff --check`: passed. Verification scripts unchanged.
- Instruction walkthrough: ordinary shared/config/dependency steps use focused
  caller/contract tests; sensitive steps keep whole affected intermediate suites
  and migration/spec requirements. Repairs follow the same rules. `/ready`
  skips nested standalone Verify and runs final Verify after builds and repairs;
  `/complete` and `/approve` retain script-controlled evidence reuse.
- No app check or audit needed for this instruction-only change. No commit or push.
- PR-title optimization: all 14 original rule cases invoke the unchanged script
  in-process. Two fresh-process CLI cases check success/failure exit codes and
  output; all 19 assertions passed. Same-runner elapsed time fell from 15.319s
  to 3.310s (one before/after comparison, about 78% less time).
- Final fresh Verify after Step 3: PASS, scope workflow, all 481 checks passed.
  Production title/verification scripts unchanged; no commit or push.

## Result

- **Prepared:** branch `fix/focused-implementation-checks`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` on 2026-10-31, scope workflow (reused from `2026-11-01T02:12:10.5819905Z`, `fix/focused-implementation-checks` @ `68ec514`; source run finished October 31 at 9:12 PM CDT).
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
  - The source run passed all seven workflow suites, 481 checks total.
- **Performance:** PR-title tests took 15.319s before and 3.310s after in one same-runner Windows PowerShell 5.1 comparison (about 78% less time); this is not a whole-Verify speedup claim.
- **Check:** not run; no observable application behavior changed.
- **Audit:** not needed for workflow instructions and test-harness changes; no formal audit run or findings recorded. Requested gap review found no blockers. Linux/PowerShell 7 behavior remains for CI confirmation.
- **Follow-ups added to build plan:** none. Profiling identified secret-guardrail process execution, repeated evidence Git queries and scope fixture construction as possible separate optimizations; none was implemented here.
- **Deploy notes:** none; production validation/verification scripts, application code, dependencies and configuration are unchanged.
