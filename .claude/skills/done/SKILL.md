---
name: done
description: After the person squash-merges a PR, check on GitHub that the branch was merged at its local tip, then switch to an up-to-date main, delete the local branch and the landing drafts, and report the merged commit's CI. Use for /done.
disable-model-invocation: true
---

# done - clean up after a merge

The person typed `/done` after squash-merging the PR on GitHub. This skill
puts the checkout back on an up-to-date `main` for the next item. It never
merges, pushes, rebases, resets, stashes or runs `git clean`, and it never
touches `main`'s history.

## 1. Checks

All must pass before anything changes. Stop at the first that fails and
report it as "When something fails or stops" in
`blueprint/context/ai-interaction.md` says: what stopped, that nothing was
changed, and that `/done` reruns every check when run again.

1. **Work branch:** `git branch --show-current` is not `main` (and not empty).
   **If it fails:** nothing to clean up. `Status: Nothing to clean up; already
   on main.` `Next: /feature` (or `/status`).
2. **Clean tree:** `git status --porcelain` is empty. The landing drafts are
   git-ignored, so they never show here.
   **If it fails:** list the changed files. They belong to work that is not
   on GitHub. `Next:` `/approve` if they belong to this branch's PR (a
   follow-up commit), otherwise `/fix "<what>"` after moving them.
3. **Merged at this tip:** find the branch's merged PR on GitHub and compare
   its head commit with `git rev-parse <branch>`.
   - With `gh` installed and `gh auth status` succeeding:
     `gh pr list --head <branch> --state merged --json number,mergedAt,headRefOid,url`.
   - Otherwise (the repository is public, no token): read
     `https://api.github.com/repos/<owner>/<repo>/pulls?head=<owner>:<branch>&state=closed`
     (owner and repo from `git remote get-url origin`) and keep the PRs whose
     `merged_at` is set; the head commit is `head.sha`.
   - Passes only when a merged PR's head commit equals the local tip.
   **If it fails:**
   - No merged PR: the PR is still open or was closed without merging.
     `Next: Squash-merge the PR on GitHub, then /done.`
   - Merged, but the tip differs: local commits were not in the merge.
     Name them (`git log --oneline <PR head>..<branch>`). `Next: /approve` to
     push them as a follow-up, or say they can be dropped.
   - GitHub cannot be reached or rate-limits: `Next:` check the connection,
     then `/done`.

## 2. Clean up

In this order, reporting each:

1. `git switch main`
2. `git pull --ff-only` (a refusal is a stop: local `main` has commits that
   are not on GitHub; never reset it).
3. Delete `blueprint/context/landing-commit.txt` and `landing-pr.md` if
   present.
4. `git branch -d <branch>`. After a squash merge `main` holds a new commit,
   so `-d` refuses with "not fully merged" once the remote branch is gone.
   Then `git branch -D <branch>`: check 3 proved GitHub merged this exact tip.
   Never use `-D` for any other refusal.

## 3. Report

- The PR number, its merge time and URL; the new `main` head
  (`git log --oneline -1`).
- The CI result on the PR's head commit:
  `https://api.github.com/repos/<owner>/<repo>/commits/<head>/check-runs`
  (or `gh pr checks <number>`). List each check and its conclusion. If
  "Server tests" or "Client lint, build and tests" finished after the merge
  time, or failed, say so plainly: the work is on `main` either way, and a
  failure needs `/fix "<what failed>"` on a new branch.
- The next build-plan item: the first unticked line in
  `blueprint/build-plan.md`.

Then end ("Ending a turn" in `blueprint/context/ai-interaction.md`):

- `Status: Merged work cleaned up; main is current.`
  `Next: /feature` (naming the item, for example `/feature` for 2.12a).
- If a required check failed:
  `Status: Merged work cleaned up; main is current, but CI failed on the merged commit.`
  `Next: /fix "<the failing check>"`.
