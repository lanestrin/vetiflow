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

Stop and point to `/feature` or `/fix` if the spec is the empty stub. Stop and
ask if the person has not approved the spec in this conversation and its
`Status` is still `not started`.

## 2. Branch

- Use the exact `**Branch:**` value in the spec.
- If it does not exist: `git fetch origin main`, then
  `git switch -c <branch> origin/main`.
- If it exists, switch to it.
- Never build on `main`. If uncommitted changes unrelated to this spec are in
  the tree, stop and ask what to do with them.
- Set the spec's `Status` to `in progress`.

## 3. Build loop

For each unticked step, in order:

1. Read only the files the step touches.
2. Make the smallest change that meets its *Done when*. Build only what the spec
   says. If the step needs a product decision, a new package, or scope beyond
   the spec, stop and propose a spec change.
3. Add the step's tests in the same change when it adds logic (see Testing in
   `coding-standards.md`). For a bug, write the failing test first.
4. Model change? Follow `/migration` for the migration in this step.
5. Run the narrow check: `/test <filter>` for the tests this step touched, or
   `npm run lint` / a build when there is no logic.
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
check, then rerun Verify. After 2 or 3 failed attempts on the same failure, stop
and explain.

When Verify passes and every box is ticked, set `Status` to `verified`.

## 6. Review packet

Read `blueprint/context/findings.md`. Then present:

- The branch and the spec title.
- Changes grouped by area (server, data, client, tests).
- Checks run, with their real results.
- Open findings, if any. Open P0 or P1 findings block `/complete`.
- Risks and anything you could not verify (for example, UI not yet seen in a browser).
- Next command: `/check` for behaviour you can observe in the app, `/audit` for
  risky work, then `/complete`.

Then offer:

1. Walk me through the implementation (a read-only tour: per step, the purpose,
   key files and symbols, data flow and non-obvious decisions).
2. Request changes.
3. Continue to the next command.

Never commit, push or merge from this skill.
