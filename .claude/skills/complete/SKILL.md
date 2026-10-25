---
name: complete
description: Finish the current feature or fix - run the final gates, archive the spec and findings to blueprint/history, tick the build plan, reset the context files, and draft the commit message and PR description for the person. Use for /complete or when wrapping up the current work item.
disable-model-invocation: true
---

# complete - archive the work and hand it over for landing

This skill closes one work item. It does **not** commit, push or open a PR. The
person does that from the drafts this skill writes.

## 1. Gates

All must pass. Stop at the first that fails and say exactly what is missing.

1. `blueprint/context/current-feature.md` holds a real spec, every build step is
   ticked and `Status` is `verified`.
2. The current branch is the spec's `**Branch:**`, not `main`.
3. `pwsh -File scripts/verify.ps1` passes now, with no options. Run it; do not
   reuse an old result if files changed since.
4. `blueprint/context/findings.md` has no P0 or P1 finding that is `open` or
   `fixed`. A `fixed` one needs `/audit` to close it first.
5. Audit ran for risky work: anything in build plan phase S or 8, migrations,
   owner data, AI output, or a diff over about 400 lines. If it did not, stop
   and recommend `/audit` (the person may say to skip it; record that).
6. `git status` shows only files in the spec's scope plus workflow files. No
   secrets, `.env`, `bin/`, `obj/` or `coverage/`.

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

Write `blueprint/context/landing.md` (git-ignored) with:

- A conventional commit message: `feat: <summary>` or `fix: <summary>`, a blank
  line, then 3 to 6 bullets saying what changed and why.
- A PR title and description: what and why, how it was verified (the Verify
  summary lines), anything the reviewer should look at, the history file, and
  deploy notes (new env vars, migrations to run on Render).

## 4. Hand over

Tell the person:

- The history file written and the build-plan line ticked.
- The exact commands to land it, for example:
  ```bash
  git status            # check the list: only this work's files
  git add <those files>  # or git add -A when nothing unrelated is listed
  git commit -F blueprint/context/landing.md   # or paste the message
  git push -u origin <branch>
  ```
  and that they open the PR on GitHub with the drafted description.
- After the PR merges: `git switch main && git pull`, delete the branch, then
  `/feature` for the next item.
