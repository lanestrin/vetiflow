# Fix: Commit and PR drafts

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/commit-and-pr-drafts`
- **Audit:** required - changes a hard rule (Claude may commit and push through `/approve`) and the workflow's safety checks; diff over 400 lines

## The problem

The workflow's commit and PR drafts are inconsistent, and one handover command is
wrong, so the history on `main` and any future release notes read unevenly.

1. **The commit would include the PR description.** `/complete` writes the commit
   message and the PR description to one file, `blueprint/context/landing.md`,
   then tells the person to run `git commit -F blueprint/context/landing.md`
   (`.claude/skills/complete/SKILL.md:50-67`). That makes the whole file, PR
   section included, the commit message.
2. **Commit types disagree.** `/complete` allows only `feat:` or `fix:`
   (`complete/SKILL.md:52`), but `coding-standards.md:142` and
   `ai-interaction.md:71` also allow `chore:`, `test:` and `docs:`, and the build
   plan has `chore/`, `docs/` and `test/` branches.
3. **Nothing links a commit or PR to its work item.** A reader of the history
   can't tell which build-plan item or fix a commit delivered.
4. **No PR template.** A PR opened without pasting the draft starts empty. Older
   commits `38304b9`, `de07d08` and `b2c258b` have no body.
5. **No guidance on who the text is for.** Nothing says the PR description is
   for a reviewer or future reader who hasn't seen the spec, or how to flag
   migrations and breaking changes.

## The fix

Make `/complete` produce two separate drafts with one consistent format, write
that format down in one place, and give GitHub the same structure as a PR
template.

- **Two files:** `blueprint/context/landing-commit.txt` (the commit message only,
  safe for `git commit -F`) and `blueprint/context/landing-pr.md` (PR title and
  description). Both git-ignored; replace the `landing.md` ignore line.
- **Type from the branch prefix:** `feature/` -> `feat`, `fix/` -> `fix`,
  `chore/` -> `chore`, `docs/` -> `docs`, `test/` -> `test`. A change that needs
  a deploy step or breaks an API contract gets `!` and a `BREAKING CHANGE:` footer.
- **Link to the work item:**
  - PR title and commit subject end with the ID for features, for example
    `feat: add owners and repeated vitals (0.2)`.
  - The commit body ends with `Refs: build-plan 0.2`, or
    `Refs: blueprint/history/fixes/<file>` for a fix.
- **Commit message:** subject in the imperative, at most 72 characters, no full
  stop. The body says why, then 3 to 6 bullets of what changed. Trailers last.
- **PR description sections:** Summary (what changes for users and why), Changes,
  How it was verified (the Verify summary lines, `/check`, `/audit`), Reviewer
  notes, Deploy notes (env vars, migrations, or "none"), History file. Written for
  a reviewer who has not read the spec; lead with the effect, not a file list.
- **`.github/pull_request_template.md`** with the same sections, so a PR opened
  any way starts with them.
- **Recommend squash merge** with the PR title as the commit subject, so each PR
  lands on `main` as one conventional commit. This is a GitHub setting the person
  changes; the docs say so but nothing enforces it.

Must not break: `/complete` still only drafts. Claude never merges; from Step 6,
it commits and pushes only through `/approve`, which the person runs.

## Build steps

### Step 1 - Write the convention down
- [x] Add a "Commit messages and PRs" section to
      `blueprint/context/coding-standards.md` with the rules above, and make
      `ai-interaction.md` "Commits and PRs" point to it instead of repeating them.

**Done when:** the type list, ID link, message shape, PR sections and squash-merge
recommendation each appear in one place, and no other file states a conflicting
type list.

### Step 2 - Fix `/complete`
- [x] Update `.claude/skills/complete/SKILL.md` sections 3 and 4 to write the two
      files in the agreed format, with `git commit -F
      blueprint/context/landing-commit.txt` in the handover, and point to the
      coding standards for the rules.
- [x] Update `.gitignore` to ignore both new files instead of `landing.md`.

**Done when:** following the skill text, the commit file contains only the commit
message, and `git check-ignore` reports both new paths as ignored.

### Step 3 - PR template
- [x] Add `.github/pull_request_template.md` with the sections from the fix.

**Done when:** the file exists and its headings match the sections `/complete`
writes.

### Step 4 - Release notes follow-up
- [x] Add build-plan item **1.7** `chore/release-notes`: `.github/release.yml` so
      GitHub's generated release notes group squash-merged commits by type, plus
      a first tag.

**Done when:** 1.7 is listed at the end of Phase 1 and nothing else in the build
plan changed.

### Step 5 - PR numbers, review changes and branch protection

Added after a second review of the workflow, approved by the person.

- [x] **PR numbers:** drop "you add the PR number when it merges" from the build
      plan rules and the result template. Squash merge puts `(#<n>)` in the commit
      subject, which already links commit and PR without editing `main`.
- [x] **Review changes after `/complete`:** a history file freezes when its PR
      merges, not when it is written. Until then, changes from review are made on
      the same branch, `/verify` runs again, and the history file's Result is
      updated. Say this in the history READMEs and in `/complete`'s handover.
- [x] **Branch protection:** add to "Merging" in the coding standards: protect
      `main`, require a PR, and require the CI checks "Server tests" and "Client
      lint, build and tests" to pass. A GitHub setting the person changes.

**Done when:** no workflow file asks anyone to edit `main` or a merged history
file after a merge, `/complete` says what to do when review asks for changes,
and the Merging section names the required checks.

### Step 6 - `/approve` to commit and push

Added at the person's request: one command that commits and pushes, so they no
longer copy the drafts by hand.

- [x] Add `.claude/skills/approve/SKILL.md` with `disable-model-invocation: true`,
      so only the person can run it and running it is the approval. It checks
      the branch (never `main`), that `/complete` ran, Verify (runs it again),
      and the file list; commits with `landing-commit.txt` or the person's own
      message; pushes without force; then hands over the PR link and
      `landing-pr.md`, or opens the PR with `gh` when it is installed and signed in.
- [x] Change the hard rule everywhere it appears (`CLAUDE.md`,
      `ai-interaction.md`, `/complete`, the build plan's "How each item works"):
      Claude commits and pushes only through `/approve`, which the person runs;
      never merges, force-pushes or commits to `main`. Add `/approve` to the
      workflow table and the loop.

**Done when:** `/approve` appears in the skill list, no file still says Claude
never commits, and every file that describes the loop ends with
`/complete` -> `/approve` -> the person merges.

### Step 7 - Clear next steps when something fails

Added at the person's request: `/complete` stopped at gate 5 and only said
"run `/audit`", with no explanation of what that meant or what came after.

- [x] Add "When something fails or stops" to `ai-interaction.md`: every failure
      or stop says what happened (error or safety stop), what changed, the exact
      next commands in order with alternatives, and what happens after each
      outcome, with `/status` as the fallback.
- [x] Give every gate in `/complete` and every check in `/approve` an
      "If it fails" line with the person's next commands. Point `/verify`,
      `/implement`, `/audit` and `/check` to the new section. `/complete` gate 3
      and `/audit` run Verify through `/verify` (Windows PowerShell fallback),
      and gate 3 treats a SKIP as a failure, so each failure has a clear next step.

**Done when:** each `/complete` gate and `/approve` check names what the person
types next, and the four other skills reference the section.

### Step 8 - One loop, no duplicates, choices with recommendations

Added after a third review of the workflow; the person chose to keep it on this
branch.

- [x] **One source each:** the loop lives only in `ai-interaction.md` (CLAUDE.md
      keeps a one-line summary, the build plan links to it); one "When to audit"
      list; one "Common failures" and one "Unexpected files" table in `/verify`
      that `/complete` and `/approve` link to; "When stuck" merged into "When
      something fails or stops"; Safety keeps only what the hard rules do not say;
      after-merge steps only in `/approve`.
- [x] **Order:** `/implement` -> `/audit` (when required, after `/clear`) ->
      `/check` -> `/complete` -> `/approve` -> merge. `/verify` leaves the loop
      list (it runs inside `/implement` and `/complete`). `/approve` skips Verify
      when only `/complete`'s own files changed since. `/audit` reuses a passing
      Verify from the session when nothing changed.
- [x] **Decide early:** specs carry `**Audit:** required | not needed` with a
      reason, set by `/feature` and `/fix`; `/audit` always records that it ran;
      `/complete` gate 5 reads both. An OK'd spec gets `Status: approved` so
      `/implement` works after `/clear`.
- [x] **Review changes** after the PR is open move from `/complete` to `/approve`.
- [x] **Choices:** a "Choosing the next step" section in `ai-interaction.md`
      (selection prompt, 2 to 4 options, recommended first, Claude acts on what it
      can, says what to type for user-only commands), used at the end of `/feature`
      and `/fix`, the `/implement` packet, every failed gate and check, Verify
      failures, audit results, `/check` failures, and the `/complete` handover.
      `/status` offers a choice when more than one next command fits.

**Done when:** each of these appears in exactly one place and the others link to
it, the loop reads the same everywhere it is summarised, and every decision
point listed above offers options with one marked recommended.

### Step 9 - Audit repairs

Added after `/audit` on 2026-10-24, approved by the person.

- [x] **F-01, F-02:** `/approve` check 2 ("Completed") requires all of:
      `current-feature.md` is the stub, and a history file whose `**Branch:**`
      is the current branch exists (so `/complete` ran for this branch), and
      `landing-commit.txt` exists or the person gave a message. A given message
      replaces only the draft text. The review follow-up path (stub plus
      history file) still passes. The after-merge row deletes
      `blueprint/context/landing-*`, and `/feature` and `/fix` preflight delete
      any stale drafts.
- [x] **F-03:** the "Spec before code" hard rule in `CLAUDE.md` names review
      changes on an open PR as the exception, pointing to `ai-interaction.md`
      step 7.
- [x] **F-04:** split `/status`'s findings row: `open` -> `/implement`
      "repair F-01"; `fixed` -> `/clear`, then `/audit`.
- [x] **F-05:** remove the extra blank lines in `feature-spec-template.md`.

**Done when:** following `/approve` on a new branch with leftover drafts and an
in-progress spec stops at check 2; on a branch that went through `/complete`,
check 2 passes with or without a given message; F-01 to F-05 are `fixed`.

## Verify

No runtime code changes, so no new tests. Run `scripts/verify.ps1` to confirm
nothing else broke, then:
- Read the edited `/complete` and check its drafts against the coding standards
  section.
- `git check-ignore -v blueprint/context/landing-commit.txt blueprint/context/landing-pr.md`
  shows both ignored.
- Next time `/complete` runs, `git commit -F blueprint/context/landing-commit.txt`
  produces a commit with no PR text in it.

## Findings

Two `/audit` runs on 2026-10-24. The first found F-01 to F-05, repaired in
Step 9. The re-audit closed all five and found F-06, left open as a P3 (repair
later with `/fix F-06`).

### F-01 [P1] closed - Stale landing drafts pass `/approve`'s "Completed" check
**Where:** `.claude/skills/approve/SKILL.md:33-38`
**Problem:** `landing-commit.txt` and `landing-pr.md` are git-ignored, so they survive the merge and the switch to `main`. Nothing deletes them (the after-merge row at line 103 doesn't, and neither do `/feature` or `/fix`). On the next item, `/approve` without `/complete` passes check 2 because the files exist. Check 3 then runs Verify (the files are newer), and the commit goes out with the previous item's message. `/complete`'s findings and audit gates are skipped, and `current-feature.md` is never archived.
**Fix:** in check 2, also require `current-feature.md` to be the stub and a history file for the current branch to exist (or the draft's `Refs:` to match it). Also delete `landing-*` in the after-merge step, or in `/feature` and `/fix` preflight.

### F-02 [P2] closed - `/approve "<message>"` skips `/complete`'s findings and audit gates
**Where:** `.claude/skills/approve/SKILL.md:33-36`
**Problem:** With a given message and no `/complete`, check 2 only stops when the spec is not `verified`. A `verified` spec with an open P1, or a required audit that never ran, gets committed and pushed. The spec is also not archived, so the merged `main` carries a live `current-feature.md` and the next `/feature` stops. This contradicts "/complete refuses to finish while any P0 or P1 finding is open".
**Fix:** when a spec is present, require `/complete` to have run, and let the given message only replace the draft's text. Allow the no-`/complete` path only when `current-feature.md` is the stub (a follow-up commit after review).

### F-03 [P3] closed - Review follow-ups are not named as an exception to "Spec before code"
**Where:** `CLAUDE.md:16`, `.claude/skills/approve/SKILL.md:102`
**Problem:** `/approve` tells Claude to make review changes on the branch without reopening the spec. The hard rule says all work starts with `/feature` or `/fix`. `ai-interaction.md` step 7 describes this flow, but the hard rule does not mention it.
**Fix:** add "(review changes on an open PR excepted; see `/approve`)" to the hard rule, or point to ai-interaction step 7.

### F-04 [P3] closed - `/status` sends `fixed` P0/P1 findings back to `/implement`
**Where:** `.claude/skills/status/SKILL.md:35`
**Problem:** The row "Open or `fixed` P0/P1 findings -> `/implement`, repair, then `/audit`" gives `fixed` findings the same next step as `open` ones. `/complete` gate 4 says a `fixed` finding only needs `/clear` and `/audit`.
**Fix:** split the row: `open` -> `/implement` "repair F-01"; `fixed` -> `/clear`, then `/audit`.

### F-05 [P3] closed - Extra blank lines in the feature spec template
**Where:** `.claude/skills/feature/reference/feature-spec-template.md:10-11`
**Problem:** Two extra empty lines after the new comment, before `## Goal`.
**Fix:** remove them.

### F-06 [P3] open - `/status` can suggest `/approve` on `main` from leftover drafts
**Where:** `.claude/skills/status/SKILL.md:40`
**Problem:** The row "Stub spec, `landing-commit.txt` present, uncommitted changes -> `/approve`" also matches `main` after a merge when the drafts were not deleted and other files are changed. `/approve` then stops safely at check 1 or 2, but `/status` pointed the person at the wrong command.
**Fix:** narrow the row to "on a work branch with a history file for it", the same condition as `/approve` check 2.

## Result

- **Shipped:** branch `fix/commit-and-pr-drafts`, squash-merged to `main` (the commit subject carries the PR number)
- **Verify:** `scripts/verify.ps1` on 2026-10-24
  - PASS  Server build
  - PASS  Server tests (25 of 25)
  - PASS  No pending model changes
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests (39 of 39)
- **Check:** not run; workflow and docs changes only, nothing to see in the running app. `git check-ignore -v` shows both `landing-commit.txt` and `landing-pr.md` ignored (`.gitignore:51-52`).
- **Audit:** required (hard rule change, diff over 400 lines). Run twice: F-01 to F-05 closed; F-06 [P3] open.
- **Follow-ups added to build plan:** 1.7 `chore/release-notes`.
- **Deploy notes:** none. In GitHub settings, turn on squash merge and protect `main` with the required checks "Server tests" and "Client lint, build and tests".
