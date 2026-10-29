---
name: complete
description: Finish the current feature or fix - run the final gates, archive the spec and findings to blueprint/history, tick the build plan, reset the context files, and draft the commit message and PR description for the person. Use for /complete or when wrapping up the current work item.
disable-model-invocation: true
---

# complete - archive the work and hand it over for landing

This skill closes one work item. It does **not** commit, push or open a PR.
`/approve`, which only the person runs, does that from the drafts this skill
writes.

## 1. Gates

All must pass. Stop at the first that fails and report it as "When something
fails or stops" in `blueprint/context/ai-interaction.md` says: which gates passed,
what stopped, that nothing was archived yet, and that `/complete` reruns every
gate when run again. `Next` is the first path in the gate's **If it fails**
line; name any other path in one sentence.

1. **Spec ready:** `blueprint/context/current-feature.md` holds a real spec,
   every build step is ticked and `Status` is `verified`.
   **If it fails:** an empty stub means there is nothing to complete; `/status`.
   Otherwise one step: `/ready` (it resumes at the first unticked step and
   sets `verified` after Verify), then `/complete`.
2. **Branch:** the current branch is the spec's `**Branch:**`, not `main`.
   **If it fails:** one step: `git switch <branch>` (uncommitted changes come
   along), then `/complete`. If the work was built on `main`:
   `git switch -c <branch>` moves the uncommitted changes to the new branch.
3. **Verify:** run `scripts/verify.ps1 -ReuseIfCurrent` (see "Reusing a run" in
   `/verify`) and report the scope and whether it reused or ran. Any FAIL or
   SKIP stops here; a `Not needed` line is not a SKIP.
   **If it fails:** the options from `/verify`'s "Common failures" table, then
   `/complete`.
4. **Findings:** `blueprint/context/findings.md` has no P0 or P1 finding that is
   `open` or `fixed`.
   **If it fails:** list the blocking IDs and titles, then the options from
   `/audit`'s report for P0 or P1 (repair, Recommended; or dispute). A `fixed`
   finding only needs confirming: `/audit focused`, then `/complete`.
5. **Files:** `git status` shows only files in the spec's scope plus workflow
   files.
   **If it fails:** list the files and why each does not belong, then the options
   from `/verify`'s "Unexpected files" table, then `/complete`.

## 2. Archive

1. **Pick the file name.**
   - Feature: `blueprint/history/features/<id>-<short-kebab-name>.md`, for
     example `2.3-board-query.md`.
   - Fix (`**Type:** Fix`): `blueprint/history/fixes/<YYYY-MM-DD>-<short-kebab-name>.md`.
   - If the file already exists (a later rebuild), add `--build-2`, `--build-3`.
     Never overwrite a history file.
2. **Write it:** the spec as it stands, `Status: complete`, then a `## Findings`
   section with the resolved findings (omit when none), then a `## Result`
   section from `reference/result-template.md`.
3. **Tick the build plan** (features only): change `- [ ]` to `- [x]` on the
   item and append `Done (history/features/<file>).` Add any follow-up items the
   work uncovered at the end of the right phase, with the next free ID. Never
   renumber existing items.
4. **Reset** `current-feature.md` and `findings.md` to their stub text (copy the
   stub wording exactly as in the repo's `main` branch:
   `git show main:blueprint/context/current-feature.md`).

## 3. Draft the landing

Follow "Commit messages and PRs" in `blueprint/context/coding-standards.md`
for the type, subject, body, trailers and PR sections. Write two git-ignored
files:

- `blueprint/context/landing-commit.txt`: the commit message and nothing else,
  so `git commit -F` can use it as is. No headings, no PR text.
- `blueprint/context/landing-pr.md`: the PR title on the first line, then the
  description with the sections in the order the standards list them. Fill
  them from the Verify output, the `/check` and `/audit` results, the Deploy
  notes and the history file just written.

AI authors both drafts in full. Apply the content rules in
"Commit messages and PRs", including truthful statements for checks not run or
sections with nothing applicable. Do not leave prompts, empty sections or
wording for the person to supply. Before handing over, read the generated PR
draft and repair missing content, duplicate sections and unfilled placeholders.
This is a document-completeness check, not an audit or another test run.

## 4. Hand over

Tell the person:

- The history file written and the build-plan line ticked.
- The commit message in full and the PR title, with a link to the completed PR
  draft so they can review it. They can request changes; AI makes those edits.
  Do not ask them to write sections or copy text over a GitHub template.
- Then end ("Ending a turn" in `blueprint/context/ai-interaction.md`):
  `Status: Results archived; commit and PR drafts prepared. Nothing committed
  yet.` `Next: /approve`

What happens after the PR is open (review changes, merging) is in `/approve`.
