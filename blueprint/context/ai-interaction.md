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

## Efficient context and tool use

- Build one bounded packet from the active spec, applicable rules, affected
  code/callers/tests and matching history. Find paths and headings first, then
  read only relevant sections; query plans for the item and decisions, and
  return counts/matching lines for status instead of loading entire documents.
- Reuse instructions already read when unchanged. Refresh branch, working diff,
  spec, findings and evidence at decision gates; after changed instructions,
  uncertain freshness or lost context, reload the relevant packet. Never use
  remembered state to authorize a gate. `/ready` and `/complete` follow their
  owning skills rather than repeating their investigation.
- Batch independent reads; keep dependent commands and edits sequential.
  Identify the narrowest useful check and whether final Verify already supplies
  a broader check. Avoid identical broad reruns without intervening changes or
  a specific failure, but never skip an explicitly required intermediate check
  or a prescribed regression/final suite for clinical data, permissions,
  migrations, security or shared contracts.
- Treat script output as evidence. Read status and failure tails first; expand
  only the relevant log section and code path. Never infer PASS from silence,
  chat memory or a manually run suite.
- Use specs, findings, logs and evidence as the durable record; add no duplicate
  context cache or summary file. For coordinated commands, report changed
  scope, decisions, actual checks (ran or reused), blockers and next action,
  not full specs or logs. Batch milestone updates; do not narrate routine passes.
- For long checks, give timely updates and poll about every 20-30 seconds,
  adjusted to expected duration. Never claim token or time savings without
  comparable measurements. To evaluate Codex allowance, compare usage for one
  ordinary feature before and after; instruction length alone is not a saving.

## The loop

This is the one description of the loop; other files summarise it and link
here. Every work item, planned or not, goes through it. The spec lives in
`blueprint/context/current-feature.md`, and its `Status` moves
`not started` -> `approved` -> `in progress` -> `verified`. `/complete` then
archives it.

The normal path is: spec -> OK and build (`/ready`) -> `/complete` -> `/approve`.

**Who does what.** Each piece has one job; each policy lives in one place and
the others link to it.

| Piece | Its one job | Policy it owns |
| --- | --- | --- |
| Spec (`current-feature.md`) | the approved scope and its *Done when* criteria | - |
| `/feature`, `/fix` | write the spec, then stop for your OK | - |
| `/implement` | build approved steps, with tests | narrow and broader checks (section 3) |
| `/verify` | run the checks the changes need and record the evidence | scope, reusing a run |
| `/ready` | coordinate `/implement`, repairs, Verify and `/check` | when to continue and when to stop |
| `/audit` | review the change, only when you ask | finding severities |
| `/complete` | archive and draft the commit and PR | completion gates |
| `/approve` | commit, push and hand over the PR | the publish boundary |
| `/done` | after your merge, return the checkout to an up-to-date `main` | when a local branch may be deleted |
| `/status` | report where things are and the next command | - |
| This file | the loop, the audit recommendation, failure reports | - |

1. **Spec.** `/feature` (planned work) or `/fix` (unplanned work) writes the spec,
   including the `**Audit:**` line (see "When to recommend an audit"), and
   stops. You choose: OK and build, OK only, change it, or drop it. On OK its
   status becomes `approved`. Nothing is built before that.
2. **Build.** "OK and build" (or `/ready` later) creates the spec's branch from
   the latest `main`, builds every step with a test for any logic, repairs
   in-scope failures, runs Verify, runs `/check` when a *Done when* needs the
   app, and ends with a readiness report. `/implement` does the build part
   only, one step at a time, if you want to go step by step.
3. **Audit, only on request.** Claude never starts `/audit`. When the spec says
   `recommended`, the readiness report says why; you type `/audit` if you want
   one. A P0 or P1 it finds blocks `/complete`: `/ready` repairs it, then
   `/audit focused` confirms the repair.
4. **Prove it.** `/check` runs the app against the "Done when" items that need
   it; `/check guide` gives you steps to try yourself. `/ready` runs it for you;
   it is skipped when nothing can be observed in the app.
5. **Complete.** `/complete` checks spec, branch, findings and files before
   Verify, then archives the spec to `blueprint/history/`, ticks the build plan,
   and drafts the commit message and PR description.
6. **Approve.** You run `/approve`. It commits with the draft, pushes and hands
   over the PR.
7. **Merge.** You squash-merge on GitHub once CI is green. Changes asked for in
   review are made on the same branch, then `/approve` again. After the merge,
   type `/done`: it confirms on GitHub that the branch was merged at its tip,
   switches to an up-to-date `main`, deletes the local branch and the landing
   drafts, and reports the merged commit's CI. Then start the next item.

**`/ready` is the default path after you OK the spec.** It runs steps 2 and 4
without asking you to type `/implement` per step, adds no review stage, and
stops before `/complete`; its skill lists when it stops to ask. Steps 5 to 7
stay yours.

**`/clear` is optional.** It frees context, for example before a large next
task. No step requires it.

Final Verify runs after builds and repairs in step 2, and at the gate in step 5;
you can also request `/verify` any time. It runs only
the checks the branch's changes need: workflow tests always, the server or
client checks only when those files changed (see "Scope" in `/verify`). Later
gates reuse its evidence instead of rerunning unchanged checks (see "Reusing a
run" in `/verify`). CI runs its own checks on every PR and never reads local
evidence.

`/ready` owns final Verify and the report when coordinating `/implement`;
standalone `/implement` owns its own. Development checks and the final-step
broad-check rule live in `/implement` section 3. Invocation and reuse policy
live in `/verify`; later gates never infer a PASS from manual suite runs.

**Resuming after a lost chat or `/clear`.** Progress lives in files: the spec's
status and ticked steps, `findings.md`, history and git. `/ready` and
`/implement` continue from the first unticked step. `/status` says where things
are and what to type next.

**Without the skills.** You can also just ask for a change in chat. The rules
here and in `coding-standards.md` still apply: a branch, small steps, tests for
logic, Verify before done.

## When to recommend an audit

`/audit` runs only when you type it. Claude never starts it, never starts a
reviewer subagent for it, and adds no self-review phase. The spec's
`**Audit:**` line is only a recommendation, and it never blocks `/complete`:

- `recommended - <reason>` when the work changes application code
  (`vetiflow.Server/`, `vetiflow.client/src/`), database behaviour (entities,
  `Data/`, migrations, stored data) or application config (`Program.cs`,
  `appsettings*.json`, `vite.config.ts`, the server `Dockerfile`). The reason
  names the risk, for example build plan phase S or 8, sign-in, roles, owner
  access, AI input or output, or a diff over about 400 lines.
- `not needed - <reason>` when the work is limited to Claude skills, workflow
  instructions (safety instructions included), docs, scripts or other tooling.

If the work grows into application code while building, `/implement` changes the
line to `recommended` and says why. The readiness report and the review packet
repeat the recommendation.

**Real problems block, however they were found.**

- A defect Claude finds while building is fixed in scope, with a regression
  test. If fixing it is outside the spec, `/ready` stops and asks.
- A failed or skipped required check blocks (`/complete`'s Verify gate).
- P0 or P1 findings from an audit you asked for block while `open` or `fixed`.
  `/ready` repairs them, and `/audit focused` confirms the repair.
- Never waive a risk, suppress a finding or lower a severity to finish. Only
  you accept a finding, and only a P2 or P3.

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

## Ending a turn

Every task and every workflow command ends with two lines, and nothing after
them:

```
Status: <what is complete, awaiting a decision, or blocked>
Next: <one exact command, reply, or action>
```

| After | Status | Next |
| --- | --- | --- |
| A spec is written | Spec prepared; awaiting your approval. | Reply "OK and build". |
| `/ready` finishes | Implementation complete; verification passed; ready to archive and prepare publication. | `/complete` |
| `/complete` | Results archived; commit and PR drafts prepared. | `/approve` |
| `/approve` | Changes committed and pushed; PR opened (or updated). | Review CI and squash-merge the PR when checks pass. |
| `/done` | Merged work cleaned up; main is current. | `/feature` |
| A stop | Blocked - <specific reason>. | <the action or decision needed to continue> |

Rules:

- **One next action.** Recommend the single best step, from the facts, with its
  reason in one line when it is not obvious. Name an alternative in a sentence
  above the two lines only when it is a real option.
- **Ask only for a genuine decision** (approving a spec, a product or scope
  choice, accepting a risk or a finding). Then use a selection prompt (the
  AskUserQuestion tool) with 2 to 4 options, the recommended one first with
  "(Recommended)" in its label, or a numbered list without the tool. The
  two-line handoff follows once the decision is made, or names the reply
  needed.
- **No vague endings**: never "let me know", "shall I continue?" or "anything
  else?".
- **Name the exact state, and never a later one.** In order: implementation
  complete, verification passed (say whether it ran or was reused), publication
  prepared (drafts written), committed, pushed, PR opened, merged, deployed.
  Claude never sees a merge or deploy happen unless it checked.
- **An audit recommendation is a separate line** above the handoff ("Audit:
  recommended - <reason>; optional, `/audit`"). It is never the `Next`.
- **While `/ready` is working:** brief milestone lines and keep going. The
  handoff comes only when it finishes or stops.
- **One report per coordinated command.** Internal skills return evidence to
  the coordinator without their own handoffs. Report the outcome, actual
  checks (scope, ran/reused, result), material limitations and next action.
  Link full evidence and drafts instead of repeating them in chat; expand
  failures and decisions as needed. `/approve` keeps its full file/message
  preview and independently checks the current evidence and PR content.
- **Acting on a choice:** when Claude can do it (accept a finding, stash files,
  follow `/ready` after "OK and build"), it does so straight away. When only the
  person can run it (`/ready`, `/audit`, `/check`, `/complete`, `/approve`,
  `/fix`), `Next` is the exact text to type.
- Skills end with this handoff; they name their usual `Status` and `Next` and
  link here instead of restating these rules.

## When something fails or stops

Every skill reports a failed check, a stopped gate or a command error the same
way. "Next: `/audit`" on its own is not enough. Always say:

1. **What happened**, in plain words, and which kind it is:
   - **Error:** something is broken (a failing test, a build error, a rejected push).
   - **Safety stop:** a gate working as designed (a blocking finding, wrong branch,
     unrelated files).
   - **Environment problem:** the machine, not the code (Docker not running, the
     app holding a file lock, a tool not installed).
2. **What changed:** "nothing", or exactly which files or state changed before
   the stop.
3. **What happens after:** what success looks like, and where the loop resumes
   (for example "then `/complete` again; it reruns every gate").
4. **The handoff** ("Ending a turn"): `Status: Blocked - <reason>.` and `Next:`
   the recommended way out. The usual ones are in the "Common failures" and
   "Unexpected files" tables in `/verify`; offer a choice only when the way
   out is a genuine decision.

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
