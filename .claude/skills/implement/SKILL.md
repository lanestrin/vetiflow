---
name: implement
description: Build or resume the approved spec in blueprint/context/current-feature.md on its branch, one step at a time with tests, then present a review packet. Use for /implement or when building the current feature or fix.
disable-model-invocation: true
---

# implement - build the approved spec

The approved `blueprint/context/current-feature.md` is the contract. Build it
and stop before any commit.

## 1. Preflight

In one batch, read:

- `blueprint/context/current-feature.md`
- `git status`, the current branch, and `git log --oneline -5`
- the Commands section of `CLAUDE.md`

- Empty stub: stop; there is nothing to build. Next: `/feature` or `/fix`.
- `Status: not started`: the spec has not been approved. Offer (see "Choosing
  the next step" in `blueprint/context/ai-interaction.md`): 1. OK it now (Claude
  sets `approved` and continues) (Recommended once they have read it).
  2. Change it first.
- `approved` or `in progress`: build from the first unticked step.
- `verified` with every step ticked: nothing left to build; show the review
  packet's next-step choice (section 6).

## 2. Branch

- Use the exact `**Branch:**` value in the spec.
- If it does not exist: `git fetch origin main`, then
  `git switch -c <branch> origin/main`.
- If it exists, switch to it.
- Never build on `main`. If uncommitted changes unrelated to this spec are in
  the tree, stop and offer the "Unexpected files" options from `/verify`.
- Set the spec's `Status` to `in progress`.

## 3. Build loop

For each unticked step, in order:

1. Read only the files the step touches.
2. Make the smallest change that meets its *Done when*. Build only what the spec
   says. If the step needs a product decision, a new package, or scope beyond
   the spec, stop and offer: change the spec (Recommended, shows the exact
   change for an OK), or build it later as a separate build-plan item or `/fix`.
   If the work now meets "When to audit", set the spec's `**Audit:**` line to
   `required` and say why.
3. Add the step's tests in the same change when it adds logic (see Testing in
   `coding-standards.md`). For a bug, write the failing test first.
4. Model change? Follow `/migration` for the migration in this step.
5. Run the narrow check: `/test <filter>` for the tests this step touched, or
   `npm run lint` / a build when there is no logic. Run the whole affected suite
   instead (`dotnet test --project vetiflow.Server.Tests`, or
   `npm run test -- --run` in `vetiflow.client`) when the step changes:
   - shared code used by more than one feature;
   - a dependency (`*.csproj`, `package.json`, `package-lock.json`,
     `.config/dotnet-tools.json`);
   - config (`Program.cs`, `appsettings*.json`, `vite.config.ts`, `tsconfig*.json`);
   - security (sign-in, roles, owner scope, redaction);
   - database code (`Data/`, entities, migrations).
6. Self-review the diff: spec coverage, sign-in and role checks, owner scope,
   no PII in logs, error handling, nothing unrelated.
7. Tick the step's box only after its check passes. If it repaired a finding,
   mark that finding `fixed` in `findings.md` (never `closed`).

Do not narrate passing steps. Keep the checkboxes current and continue. If a
step's diff grows too big to review, split it in the spec first.

## 4. Before final verification

- Compare every In scope line and every *Done when* against the diff.
- Remove anything this work added that the spec does not need (extra
  abstractions, settings, packages).

## 5. Verify

Run `/verify` once. If it fails, fix only in-scope problems, rerun the narrow
check, then rerun Verify. After 2 or 3 failed attempts on the same failure, or
when the problem is outside this spec, stop as "When something fails or stops"
says: what failed, which steps are ticked, and the options from `/verify`'s
"Common failures" table. `/implement` resumes where it stopped.

When Verify passes and every box is ticked, set `Status` to `verified`.

## 6. Review packet

Read `blueprint/context/findings.md`. Then present:

- The branch and the spec title.
- Changes grouped by area (server, data, client, tests).
- Checks run, with their real results.
- Open findings, if any. Open P0 or P1 findings block `/complete`.
- The spec's `**Audit:**` line.
- Risks and anything you could not verify (for example, UI not yet seen in a browser).

Then offer the next step (see "Choosing the next step"). The first option follows
the loop:

1. The next loop step (Recommended):
   - Audit `required`: `/clear`, then `/audit`.
   - Otherwise, when a *Done when* needs the running app: `/check` (or
     `/check guide` to try it yourself).
   - Otherwise: `/complete`.
2. Hand the rest to `/ready`: review in a fresh subagent, repair and re-review
   up to 3 rounds, `/check` when needed, then stop before `/complete`.
3. Walk me through it first: a read-only tour per step (purpose, key files and
   symbols, data flow, non-obvious decisions), then this choice again.
4. Request changes: say what; they become spec changes for your OK.

Never commit, push or merge from this skill.
