---
name: approve
description: Commit and push the finished work on the current branch after /complete - check the branch, Verify and the file list, commit with the drafted or given message, push, and hand over the PR. Only the person runs it; running it is their approval. Use for /approve or /approve "<message>".
disable-model-invocation: true
---

# approve - commit and push the finished work

The person typed `/approve`, so they approve this one commit and push. This is
the only way Claude commits or pushes. It never merges, never force-pushes and
never commits to `main`. Approval covers this run only; the next commit needs
another `/approve`.

## Input

- `/approve`: use `blueprint/context/landing-commit.txt` as the message.
- `/approve "<message>"`: use the person's message instead. If its subject does
  not follow "Commit messages and PRs" in `coding-standards.md` (type, at most 72
  characters), say how it differs and suggest a fixed subject, but use theirs
  unless they change it.

## 1. Checks

All must pass. Stop at the first that fails and report it as "When something
fails or stops" in `blueprint/context/ai-interaction.md` says: what stopped, that
nothing was committed or pushed, and that `/approve` reruns every check when run
again. `Next` is the first path in the check's **If it fails** line; name any
other path in one sentence.

1. **Branch:** `git branch --show-current` is a work branch, not `main`.
   **If it fails:** `git switch -c <branch from the spec or history file>` (the
   uncommitted changes move with it), then `/approve`.
2. **Completed:** `/complete` ran for this branch. All of:
   - `current-feature.md` is the stub (`/complete` archived the spec);
   - a file in `blueprint/history/` has the line ``**Branch:** `<current branch>` ``;
   - `landing-commit.txt` exists, unless the person gave a message.

   Drafts left from an earlier branch never pass this check on their own. A
   given message replaces only the draft text, never `/complete`. A follow-up
   commit after review passes, since the spec stays archived.
   **If it fails:** a spec in `current-feature.md`: `/complete` (it runs its
   gates and writes both drafts), then `/approve`; for a spec not yet
   `verified`, `/ready` first. A stub with no history file for this branch:
   the work has no spec; `/fix "<what>"` to give it one.
3. **Verify:** run `scripts/verify.ps1 -ReuseIfCurrent` (see "Reusing a run" in
   `/verify`) and report whether it reused or ran. Any FAIL or SKIP stops here.
   `/complete`'s archive and drafts do not change the fingerprint, so its
   result is reused unless other files changed since.
   **If it fails:** the options from `/verify`'s "Common failures" table, then
   `/approve`.
4. **Files:** `git status --short --untracked-files=all`. Stop if any path is in
   `/verify`'s "Unexpected files" table (also `appsettings.*.local.json`, user
   secrets and `node_modules/`), or clearly belongs to other work.
   `blueprint/context/landing-*` is git-ignored and never committed.
   **If it fails:** the options from that table, then `/approve`.
5. **Nothing to commit?** If the tree is clean and the branch is already pushed
   and up to date, say so and stop.
   `Status: Nothing to commit; the branch is already pushed.`
   `Next: Review CI and squash-merge the PR when checks pass` (or open it, if
   none is open).

## 2. Commit

1. Show the file list and the message in one short block.
2. `git add -A`, then `git status --short` to confirm the staged list matches
   what was shown.
3. Commit:
   - Draft: `git commit -F blueprint/context/landing-commit.txt`.
   - Given message: write it to a temp file in the scratchpad and use `-F`.
4. Never pass `--no-verify`, `--amend` or `--no-gpg-sign`. If a hook fails,
   report its output and stop.
   **If it fails:** nothing was committed. Say what the hook reported.
   `Status: Blocked - the commit hook rejected the commit.` When the problem is
   in this work's files, Claude fixes it and runs `/verify`, then
   `Next: /approve`. When it is unrelated: `Next: /fix "<what>"` on its own
   branch.

## 3. Push

- First push of the branch: `git push -u origin <branch>`.
- Otherwise: `git push`.
- Never `--force` or `--force-with-lease`. If the push is rejected because the
  remote moved, stop and explain; do not rebase or merge on your own.
  **If it fails:** the commit exists locally but is not on GitHub. Say which
  case it is; each has one path:
  - Rejected, the remote branch has new commits: `git pull --no-rebase`,
    Claude helps resolve any conflicts, `/verify`, then `/approve` (it pushes the
    existing commit).
  - Authentication or network error: sign in to GitHub again (Git Credential
    Manager opens a window on the next push) or check the connection, then
    `/approve`.

## 4. Hand over

- The commit hash and subject, and that the push succeeded.
- **The PR:**
  - If `gh` is installed and `gh auth status` succeeds and no PR is open for the
    branch: `gh pr create --base main --title "<first line of landing-pr.md>"
    --body-file <the rest of landing-pr.md in a scratchpad file>`. Give the PR URL.
  - Otherwise give `https://github.com/<owner>/<repo>/pull/new/<branch>` (from
    `git remote get-url origin`) and show the PR title and description from
    `landing-pr.md` ready to paste.
  - If a PR is already open (a follow-up commit after review), say the push
    updated it.
- **What happens next**, as a short table:

  | When | You do |
  | --- | --- |
  | CI is green and the review is done | Squash-merge the PR on GitHub. |
  | CI fails or review asks for changes | Ask Claude for the change on this branch (standards and tests still apply). Claude runs `/verify`, adds the new Verify lines and what changed to the history file's `## Result`, and rewrites `landing-commit.txt` as a follow-up message. Then `/approve` again; the push updates the PR. Do not reopen `current-feature.md`. |
  | After the merge | `/done`: it checks GitHub merged this branch's tip, switches to an up-to-date `main`, deletes the local branch and the landing drafts, and reports the merged commit's CI. Then `/feature` for the next item (or `/status`). `/clear` first is optional, to start with a fresh context. The history file is final from here. |

- Then end ("Ending a turn" in `blueprint/context/ai-interaction.md`), naming
  only what happened:
  - PR opened or updated: `Status: Changes committed and pushed; PR opened (or
    updated).` `Next: Review CI and squash-merge the PR when checks pass.`
  - No `gh`: `Status: Changes committed and pushed; PR not opened yet.`
    `Next: Open the PR at <url> with the title and description shown above.`
  - Never say merged: Claude does not merge.
