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

This is the one description of the loop; other files summarise it and link
here. Every work item, planned or not, goes through it. The spec lives in
`blueprint/context/current-feature.md`, and its `Status` moves
`not started` -> `approved` -> `in progress` -> `verified`. `/complete` then
archives it.

1. **Spec.** `/feature` (planned work) or `/fix` (unplanned work) writes the spec,
   including the `**Audit:**` line (see "When to audit"), and stops. You choose:
   OK it, change it, or drop it. On OK its status becomes `approved`. Nothing is
   built before that.
2. **Build.** `/implement` creates the spec's branch from the latest `main` and
   builds one step at a time, with a test for any logic (`/test` for quick
   checks). It runs Verify once at the end, sets `verified`, and ends with a
   review packet and a choice of next steps.
3. **Audit**, only when the spec says `required`. `/clear` first, so the review
   comes from a session that did not write the code, then `/audit`. P0 or P1
   findings go back to `/implement`, then `/audit` again.
4. **Prove it.** `/check` runs the app against the "Done when" items that need
   it; `/check guide` gives you steps to try yourself. Skipped when nothing can
   be observed in the app.
5. **Complete.** `/complete` reruns the gates, including Verify, archives the
   spec to `blueprint/history/`, ticks the build plan, and drafts the commit
   message and PR description.
6. **Approve.** You run `/approve`. It commits with the draft, pushes and hands
   over the PR.
7. **Merge.** You squash-merge on GitHub once CI is green. Changes asked for in
   review are made on the same branch, then `/approve` again. After the merge,
   `/clear` and start the next item from the updated `main`.

`/verify` runs inside steps 2 and 5. Run it yourself whenever you want the full
check.

**Resuming after a lost chat or `/clear`.** Progress lives in files: the spec's
status and ticked steps, `findings.md`, history and git. `/implement` continues
from the first unticked step. `/status` says where things are and what to type
next.

**Without the skills.** You can also just ask for a change in chat. The rules
here and in `coding-standards.md` still apply: a branch, small steps, tests for
logic, Verify before done.

## When to audit

The spec's `**Audit:**` line is `required` when the work touches any of:

- build plan phase S or 8;
- sign-in, roles, owner access or the owner page;
- migrations or stored data;
- AI input or output;
- a hard rule in `CLAUDE.md`, or a workflow skill's safety checks;
- or a diff over about 400 lines.

Otherwise it is `not needed`. Both come with a one-line reason. If the work grows
into one of these while building, `/implement` changes the line to `required`
and says why. `/complete` gate 5 reads it.

## Branching

- One branch per work item, named as in the build plan or the spec.
- Prefixes: `feature/` planned features, `fix/` fixes, `chore/` tooling and
  config, `docs/` documentation, `test/` test-only work.
- Branch from the latest `main`. If the working tree has uncommitted changes
  that are not part of this work, stop and offer the "Unexpected files" options
  from `/verify`.
- One active work item per checkout. For parallel work, use a second clone or
  `git worktree add ../vetiflow-<name> -b <branch> main`, and run the loop there.

## Commits and PRs

- Claude commits and pushes only through `/approve`, which only you run (hard
  rule in `CLAUDE.md`). Merging is yours.
- `/complete` writes the draft commit message to
  `blueprint/context/landing-commit.txt` (ready for `git commit -F`) and the PR
  title and description to `blueprint/context/landing-pr.md`. Neither file is
  committed.
- Format, types and merge strategy: "Commit messages and PRs" in
  `coding-standards.md`.

## Safety

The hard rules in `CLAUDE.md` always apply. In addition:

- Never seed a hosted database.
- Never print or copy secrets, connection strings or `.env` contents into chat,
  specs, history or commit messages.
- Never read, edit or create real `.env` files, and never run commands that list
  secret values (`dotnet user-secrets list`, `printenv`, `env`,
  `Get-ChildItem env:`), even masked. Apply migrations with
  `scripts/db-target.ps1 -Migrate` and start the app with
  `scripts/db-target.ps1 -StartApp`: they act only on a local database and bind
  the command to the string they checked. The plain check prints only `local`,
  `NOT local` or `not configured`, and authorizes nothing by itself. Test
  protections with harmless fixtures only (`scripts/tests/integration/`).
- Know what enforces this and what does not:

  | Control | Enforced by | Does not cover |
  | --- | --- | --- |
  | `Read`/`Edit` deny rules in `.claude/settings.json` | Claude Code: file tools, `@` mentions, IDE context, recognised commands such as `cat` and `Get-Content`, `<`/`>` redirects | `grep -r .` from the folder; any script that opens files itself |
  | `.claude/hooks/block-secret-commands.mjs` with `onFailure: "block"` (blocks malformed events; a missing `node` or script, a crash or a timeout blocks the call) | Claude Code, by matching command text | scripts that read `process.env` or files themselves; spellings it doesn't list. It also blocks any command whose text names a blocked command, a `.env` file, a connection-string variable (`ConnectionStrings__`, `ConnectionStrings:`, `CONNSTR_`, `VETIFLOW_TEST_POSTGRES`) or `/proc/*/environ`, such as a search or a heredoc: use the Grep and Edit tools instead |
  | `scripts/db-target.ps1 -Migrate` / `-StartApp` | the script: checks, then binds the child's connection string | `dotnet ef` or `dotnet run` started directly (advisory rule only) |
  | `.gitignore`, `vetiflow.Server/.dockerignore` | git, Docker | Claude's access to the files |
  | This file, `CLAUDE.md`, skills | nothing (advisory) | any boundary |

  OS-level isolation needs the Claude Code sandbox, which runs on macOS, Linux
  and WSL2 only. On native Windows commands run unsandboxed, so these controls
  reduce mistakes but do not make secret files unreachable. Keep real
  credentials out of the development machine where possible: a disposable local
  database password, hosted secrets only in Render and Vercel.
- Never weaken a deny rule, the hook or `.dockerignore` to make a build or test
  pass. Stop and report instead.
- Never disable, skip or delete a test to make Verify pass. A failing test is
  either a real bug or a wrong test; say which and why.

## Choosing the next step

Whenever there is more than one sensible next step, let the person choose:

- Ask with a selection prompt (the AskUserQuestion tool): 2 to 4 options, the
  recommended one first with "(Recommended)" in its label, each with one line on
  what it does and what follows. The person can always type their own answer.
- Without that tool, use a numbered list, mark the recommended option, and ask
  for the number.
- Recommend from the facts and say why in one line: the safer option when the
  risk is real, the shorter path when it is not.
- After the choice, act on it straight away when Claude can (record a skipped
  audit, accept a finding, stash files, add a repair step to the spec). When it
  is a command only the person can run (`/implement`, `/audit`, `/check`,
  `/complete`, `/approve`, `/fix`, `/clear`), say exactly what to type, in order.
- With only one sensible next step, skip the prompt and say what to type.

## When something fails or stops

Every skill reports a failed check, a stopped gate or a command error the same
way. "Next: `/audit`" on its own is not enough. Always say:

1. **What happened**, in plain words, and which kind it is:
   - **Error:** something is broken (a failing test, a build error, a rejected push).
   - **Safety stop:** a gate working as designed (audit required, wrong branch,
     unrelated files).
   - **Environment problem:** the machine, not the code (Docker not running, the
     app holding a file lock, a tool not installed).
2. **What changed:** "nothing", or exactly which files or state changed before
   the stop.
3. **What you do next:** the options, as in "Choosing the next step". The
   common ones are in the "Common failures" and "Unexpected files" tables in
   `/verify`.
4. **What happens after:** what success looks like, and where the loop resumes
   (for example "then `/complete` again; it reruns every gate").

Also:

- After 2 or 3 failed attempts at the same problem, stop and report it this way.
  No random fixes.
- If the spec is wrong or missing a decision, stop and offer a spec change.
- If requirements are unclear, ask.
- When unsure where things stand, `/status` gives the state and the next command.

## Code changes

- Make the smallest change that meets the step's "Done when".
- Do not refactor unrelated code. Note it as a build-plan idea instead.
- Follow the patterns already in the codebase.
