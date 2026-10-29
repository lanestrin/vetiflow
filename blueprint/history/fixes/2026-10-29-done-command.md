# Fix: /done command for after a merge

**Type:** Fix
**Status:** complete
**Branch:** `fix/done-command`
**Audit:** recommended - a new workflow skill that switches branches and deletes a local branch (workflow-safety work).

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

After a PR is squash-merged, the person types the same four steps by hand
(`/approve`'s "After the merge" row, `.claude/skills/approve/SKILL.md:111`):

```
git switch main
git pull
git branch -d <branch>
rm blueprint/context/landing-commit.txt blueprint/context/landing-pr.md
```

They asked for this to run automatically when they type `/done`, and for the
rules to say so.

The steps as written also fail after a squash merge (seen with PR #79,
2026-10-29): GitHub deletes the remote branch, so the local branch loses its
upstream, and `main` holds a new squash commit rather than the branch's own
commits. `git branch -d feature/triage` then refuses with "not fully merged".

## The fix

A person-only `/done` skill (`disable-model-invocation: true`, like `/ready`,
`/complete` and `/approve`) that runs the clean-up safely:

1. **Checks, stopping at the first that fails (nothing changed yet):**
   - The current branch is a work branch, not `main`.
   - The working tree has no changes other than the git-ignored landing
     drafts (`git status --porcelain` is empty).
   - The branch's PR is merged: GitHub's API for
     `repos/<owner>/<repo>/pulls?head=<owner>:<branch>&state=closed` shows a
     PR with `merged_at` set, and its head SHA equals the local branch tip
     (so no local commit was left out of the merge). Read without a token
     (public repo); `gh` is used instead when installed and signed in.
2. **Clean-up:** `git switch main`, `git pull --ff-only`, delete the drafts
   if present, then `git branch -d <branch>`; when `-d` refuses only
   because of the squash merge, `git branch -D <branch>`, which is safe
   because step 1 proved the exact tip was merged.
3. **Report:** the PR number and merge time, the new `main` head, the CI
   result on the merged commit (the same API, `check-runs`), and whether the
   required checks ("Server tests", "Client lint, build and tests") had
   passed when it merged. Then `Status: Merged work cleaned up; main is
   current.` and `Next: /feature` (naming the next build-plan item).

It must not break: never touching `main`'s history, never deleting a branch
whose tip isn't the merged PR head, never running `git clean`, `reset`,
`stash` or a force push, and never reading secrets.

The rules are updated to match: `CLAUDE.md` (Workflow loop and command
table), `blueprint/context/ai-interaction.md` (step 7 and the "Ending a
turn" table), and `/approve`'s "After the merge" row and closing `Next`,
which now say `/done`.

## Build steps

- [x] **Step 1 - failing guard test** - `scripts/tests/skill-guards.tests.ps1`
  adds `done` to the person-only skills. *Done when:* it fails before the
  skill exists.
- [x] **Step 2 - the skill and the rules** - `.claude/skills/done/SKILL.md`
  and the three rule files above. *Done when:* the guard test passes and
  Verify's workflow tests pass.
- [x] **Step 3 - dry run of the checks** - Claude follows the skill's check
  list by hand on `fix/done-command` before its PR exists. *Done when:* it
  stops at "no merged PR for this branch" and nothing in the checkout
  changed (same branch, same `git status`).

## Verify

- `skill-guards.tests.ps1` (in Verify's workflow tests) pins `/done` as
  person-only.
- Step 3's dry run. The first real run is the person's `/done` after this
  PR merges: it should switch to an up-to-date `main`, delete
  `fix/done-command` locally and report the PR's CI result.

## Notes for the AI

- `/done` is person-only, so Claude never starts it; Step 3 only reads.
- Before this branch is cut, the local `feature/triage` (PR #79, merged at
  2026-10-29T01:30:25Z, remote branch deleted) is cleaned up by hand with the
  same checks, so `fix/done-command` starts from a current `main`.

## Notes from the build

- Step 3 as observed: on `fix/done-command` with this fix uncommitted, the
  checks stop first at check 2 (6 changed files), which is correct before
  `/approve`; check 3 on its own also stops (no merged PR for the branch).
  Branch and `git status` were unchanged afterwards.
- The hand clean-up of `feature/triage` before cutting this branch used the
  same checks: PR #79 merged at the local tip `e332646`. `git branch -d`
  succeeded there only because a stale `refs/remotes/origin/feature/triage`
  was still in the checkout; after a pruning fetch it refuses, which is the
  case the `-D` fallback covers.

## Result

- **Prepared:** branch `fix/done-command`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-29 (reused from 2026-10-29T01:41:12Z, fix/done-command @ 665fe12; run in full after the last change)
  - PASS Workflow tests
  - PASS Server build
  - PASS Server tests
  - PASS Client lint
  - PASS Client build
  - PASS Client tests
- **Check:** no running app involved. `skill-guards.tests.ps1` failed (1 of 6) before the skill existed and passes (6 of 6) after. Dry run of `/done`'s checks on `fix/done-command`: stopped at check 2 (6 uncommitted files) with check 3 also stopping (no merged PR); branch and `git status` unchanged. The first real run is the person's `/done` after this PR merges.
- **Audit:** recommended, not run (workflow-safety change: switches branches and deletes a local branch).
- **Follow-ups added to build plan:** none
- **Deploy notes:** none (workflow files only).
