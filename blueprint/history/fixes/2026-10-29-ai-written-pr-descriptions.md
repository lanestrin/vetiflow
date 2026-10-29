# Fix: AI-written commit and PR descriptions

**Type:** Fix
**Status:** complete
**Branch:** `fix/ai-written-pr-descriptions`
**Audit:** not needed - workflow documentation only; no application or secret-handling change.

## Goal and authorization

The person asked AI to write all PR content and remove or adjust anything that
requires them to fill it in. They also asked Codex to save changes uncommitted
on a new branch and leave the remaining workflow to Claude.

## Scope

- Replace the visible empty PR questionnaire with a short AI instruction
  pointing to the canonical writing standard.
- Require AI to write the complete commit/PR drafts from actual changes and
  evidence, with truthful statements for unused or unverified sections.
- Have /complete and /approve check draft completeness and repair omissions.
- Replace the manual copy/paste fallback with tool/browser publishing or a
  prefilled GitHub form. Preserve person-only approval and merge boundaries.
- Let an already-pushed branch continue to PR creation without an empty commit.

## Boundaries

No changes to the separate /done work, application code, CI gates, dependencies,
secrets or approval flags. No audit, commit, push, PR creation or deployment.

## Steps

- [x] Save the template, standard and skill instruction updates.
- [x] Run the existing focused skill-guard and diff hygiene checks.
- [x] Claude verifies the workflow changes and completes the handoff.

## Verification and handoff

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/skill-guards.tests.ps1`:
  all 5 checks passed. The person-only invocation flags remain intact.
- `git diff --check`: passed.
- Full Verify, completion and publication were not run; they are left to Claude
  as requested. All five changed files remain uncommitted on this fix branch.
- These are instruction changes, not a new executable PR-body validator.
- GitHub's documented `quick_pull`, `title` and `body` parameters support the
  prefilled-form fallback. Too-long URLs or missing access remain explicit
  blockers rather than work assigned to the person to compose.

The separate /done branch also changes /approve; its work is untouched, and
Claude should preserve both changes when bringing these branches together.

## Notes from Claude's build (2026-10-29)

- Approved by the person ("OK and build") on 2026-10-29.
- Brought up to `main` at `00df96a` (after `/done`, PR #80): the uncommitted
  work was saved as a patch, the branch fast-forwarded from `665fe12`, and
  the patch reapplied with `git apply --3way`, cleanly. `/done`'s "After the
  merge" row in `/approve` is unchanged; this work touches the checks and the
  PR handover around it.
- Read the full diff against this spec: the template, the standard and both
  skills say the same thing, and no workflow file still asks the person to
  paste or fill in PR text. No test reads the PR template.
- `skill-guards.tests.ps1`: all 6 checks passed (6 now that `/done` is
  pinned). `git diff --check`: passed.
- `scripts/verify.ps1` from this worktree, 2026-10-29 (ran): PASS for
  Workflow tests, Server build, Server tests, Client install, Client lint,
  Client build and Client tests.

## Result

- **Prepared:** branch `fix/ai-written-pr-descriptions`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-29 (reused from 2026-10-29T01:56:37Z, fix/ai-written-pr-descriptions @ 00df96a; run in full from this worktree)
  - PASS Workflow tests
  - PASS Server build
  - PASS Server tests
  - PASS Client install
  - PASS Client lint
  - PASS Client build
  - PASS Client tests
- **Check:** not run; workflow instructions only, no running-app behaviour. `skill-guards.tests.ps1` 6 of 6 and `git diff --check` clean.
- **Audit:** not run. The spec says not needed; Claude suggested recommended, since `/approve` may now create PRs through a browser.
- **Follow-ups added to build plan:** none
- **Deploy notes:** none (workflow files only).
