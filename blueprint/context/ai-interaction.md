# AI Interaction Guidelines

> How Claude works with you on VetiFlow. The skills in `.claude/skills/` follow
> this file. Change it here and every skill follows the change.

## Communication

- Be concise and direct. Lead with the result, then the detail.
- Explain non-obvious decisions in a sentence.
- Ask before large refactors, new packages or architectural changes.
- Never add features that are not in the spec.
- Never delete files without asking.

## Output formatting

- Real markdown: short lines, bold labels, a blank line between blocks.
- Steps, options and findings are lists. Comparisons are tables.
- Backticks for code, paths, commands and file names.
- No deep bullet nesting on short answers.

## The loop

Every planned item follows this loop. The spec lives in
`blueprint/context/current-feature.md`.

1. **Spec.** `/feature` (or `/fix`) writes the spec and stops. You review it.
   Nothing is built until you say OK.
2. **Branch.** `/implement` creates the branch named in the spec from the latest
   `main`. Never build on `main`.
3. **Build in small steps.** One step at a time, in order. Each step ends with
   something working and its "Done when" met.
4. **Test with the step.** Logic gets its test in the same step. Run the narrow
   test (`/test`) while working, then full Verify once at the end.
5. **Review packet.** After the last step, `/implement` shows one packet:
   changed files by area, checks run with real results, risks, and the next
   command. It then offers a walkthrough of the code.
6. **Prove it.** `/check` runs the app against the "Done when" list.
   `/check guide` gives you a short "Try it now" to click through yourself.
7. **Audit when it matters.** Run `/audit` for anything in build plan phase S
   or 8, migrations, owner data, AI output, or a large diff. Open P0 or P1
   findings block `/complete`.
8. **Complete.** `/complete` checks the gates, archives the spec to
   `blueprint/history/`, ticks the build plan, resets the context files and
   drafts the commit message and PR description.
9. **You land it.** You review the diff, commit, push and open the PR. After the
   merge, the next item starts from the updated `main`.

**Resuming after a lost chat.** Progress lives in files. The spec's ticked steps
say what is done; git says what changed. A fresh `/implement` continues from the
first unticked step. `/status` summarises where things are.

**Without the skills.** You can also just ask for a change in chat. The rules
here and in `coding-standards.md` still apply: a branch, small steps, tests for
logic, Verify before done.

## Branching

- One branch per work item, named as in the build plan or the spec.
- Prefixes: `feature/` planned features, `fix/` fixes, `chore/` tooling and
  config, `docs/` documentation, `test/` test-only work.
- Branch from the latest `main`. If the working tree has uncommitted changes
  that are not part of this work, stop and ask.
- One active work item per checkout. For parallel work, use a second clone or
  `git worktree add ../vetiflow-<name> -b <branch> main`, and run the loop there.

## Commits and PRs

- **Claude never commits, pushes, merges or opens a PR.** You do all of these.
- `/complete` writes a draft commit message and PR description to
  `blueprint/context/landing.md` for you to copy. That file is not committed.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `test:`, `docs:`),
  one work item per commit.

## Safety

- Never run migrations or seeding against production or any hosted database.
  Check the connection string before `dotnet ef database update`.
- Never print or copy secrets, connection strings or `.env` contents into chat,
  specs, history or commit messages.
- Never disable, skip or delete a test to make Verify pass. A failing test is
  either a real bug or a wrong test; say which and why.

## When stuck

- After 2 or 3 failed attempts at the same problem, stop and explain what you
  tried and what you saw. No random fixes.
- If the spec is wrong or missing a decision, stop and propose a spec change.
- If requirements are unclear, ask.

## Code changes

- Make the smallest change that meets the step's "Done when".
- Do not refactor unrelated code. Note it as a build-plan idea instead.
- Follow the patterns already in the codebase.
