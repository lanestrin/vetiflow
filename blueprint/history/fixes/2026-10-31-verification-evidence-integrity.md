# Fix: Verification evidence integrity

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/verification-evidence-integrity`
- **Audit:** not needed - changes are limited to verification scripts, tests and workflow documentation; no application code, data or application configuration changes.

## The problem

`Test-VerifyEvidence` in `scripts/verify-evidence.ps1` accepts any non-empty
list of passing steps. The existing regression test explicitly proves that a
single `Workflow tests` step can be reused as a `full` PASS. This means
incomplete evidence can authorize `/ready`, `/complete` or `/approve` to skip
required checks.

Evidence records the branch and commit, but reuse does not compare either with
the current checkout. `scripts/verify.ps1` fingerprints files before running
checks but does not confirm that the relevant repository state is unchanged
before it writes a PASS. A branch, commit or relevant file change during Verify
can therefore leave evidence that does not prove the current checkout.

## The fix

Make evidence reusable only when it proves the complete verification plan for
its recorded mode and still belongs to the current repository state:

- Validate the expected successful steps for `workflow`, `server`, `client`
  and `full` modes. Reject missing, duplicate, unknown, failed or otherwise
  invalid steps.
- Represent conditional steps explicitly. A valid run may record Docker as not
  applicable when `VETIFLOW_TEST_POSTGRES` is set, and client install as not
  applicable when the installed lockfile is current. Do not treat either
  condition as a missing required step or let a missing mandatory suite pass.
- On reuse, compare the evidence branch and commit with the current branch and
  `HEAD`, in addition to the existing scope and fingerprint checks.
- Capture repository identity and fingerprint before verification and confirm
  they still match before writing reusable PASS evidence. If relevant state
  changed during the run, report the reason and do not return success or write
  reusable PASS evidence.
- Preserve existing scopes, mandatory suites, security and database
  safeguards, approval boundaries, and workflow-test behavior. Include and
  validate the already-started workflow instruction changes in this branch:
  avoid duplicate broad checks during `/ready`, run final Verify after builds
  and repairs, keep `/complete` preflight ahead of Verify, and keep context
  reads and reports concise without weakening gates. Do not add
  dependency-aware caching, workflow-test selection, CI restructuring or npm
  installation optimization.

## Build steps

- [x] **Step 1 - failing evidence regressions.** Extend
  `scripts/tests/verify-evidence.tests.ps1` to cover complete expected steps for
  each mode, valid and not-applicable conditional steps, and rejection of
  missing, duplicate, unknown and failed steps. Add branch and commit mismatch
  cases and a regression for repository state changing during verification.
  *Done when:* the tests fail against the current implementation for the
  incomplete-step, identity-reuse and in-run state-change cases, while
  accepting valid mode-specific evidence with explicitly inapplicable
  conditional steps.
- [x] **Step 2 - enforce evidence integrity.** Update
  `scripts/verify-evidence.ps1` and `scripts/verify.ps1` to validate the
  mode-specific step plan, checkout identity and start/end repository state.
  Update only the directly related evidence and reuse guidance in
  `.claude/skills/verify/SKILL.md`, retaining its existing edits and
  instructions. *Done when:* the focused regressions pass; incomplete or
  mismatched evidence is never reused; a state change during a run cannot
  produce a reusable PASS; and valid conditional-step evidence remains
  reusable. The instructions accurately describe complete step evidence,
  conditional steps and the identity/fingerprint reuse gates.
- [x] **Step 3 - reconcile the workflow instructions.** Complete and
  cross-check the existing edits to `/implement`, `/ready`, `/complete`,
  `/feature`, `/verify` and `blueprint/context/ai-interaction.md`. Preserve
  required intermediate checks, run the final scoped Verify only after builds
  and repairs, keep `/complete`'s cheap gates before Verify, and retain the
  person-only audit/publication boundaries. Keep reading packets and handoffs
  concise without dropping required policy. *Done when:* an instruction
  walkthrough confirms standalone `/implement`, coordinated `/ready`, and
  `/complete` each use the correct Verify invocation and reuse policy; no
  required check or blocker gate is weakened; `git diff --check` passes; and
  workflow tests pass.

## Verify

- Run the focused regression suite:
  `powershell -ExecutionPolicy Bypass -File scripts/tests/verify-evidence.tests.ps1`.
- Run `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1` through the
  normal readiness workflow. Because Verify's scripts determine scope, report
  the actual scope and any environment limitation (including Docker or local
  Postgres availability). Report the focused test result separately; do not
  treat it as a substitute for Verify.
- The instruction-only step also requires `git diff --check` and the stated
  walkthrough. Report any full Verify build/test limitation accurately.
- Do not commit or push. Stop after implementation and verification for review.

## Result

- **Prepared:** branch `fix/verification-evidence-integrity`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` on 2026-10-31, scope full (reused from `2026-11-01T01:42:16.4395622Z`, `fix/verification-evidence-integrity` @ `4a5efd8`). Changes to Verify itself require full scope. The source run finished at 8:42 PM CDT on October 31.
  - PASS  Workflow tests
  - PASS  Docker
  - PASS  Server build
  - PASS  Server tests
  - NOT_APPLICABLE  Client install (installed lockfile is current)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** not run; this fix changes verification tooling and workflow instructions, with no observable application behavior to check.
- **Audit:** not needed; scripts, tests and workflow documentation only. No audit run or findings recorded.
- **Follow-ups added to build plan:** none (unplanned fix).
- **Deploy notes:** none; no application configuration, dependencies, migrations or runtime code changed.
