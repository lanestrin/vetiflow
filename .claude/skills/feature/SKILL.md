---
name: feature
description: Turn the next, named or numbered build-plan item into a buildable spec in blueprint/context/current-feature.md, with small steps and a Done when per step, then stop for review. Use for /feature or when starting planned work.
disable-model-invocation: true
---

# feature - write the spec for one build-plan item

This skill plans one item and stops. It never writes product code. Its only
output is `blueprint/context/current-feature.md`.

## 1. Preflight

- Read `blueprint/context/current-feature.md`. If it holds a real spec, stop
  ("Ending a turn" in `blueprint/context/ai-interaction.md`):
  `Status: Blocked - <spec title> is still active.` `Next: /ready` to finish
  it. Say in one sentence that replying "drop it" resets `current-feature.md`
  and `findings.md` to their stubs (from `main`) instead.
- Delete `blueprint/context/landing-commit.txt` and `landing-pr.md` if present.
  They are git-ignored drafts from finished work and must not reach `/approve`
  on the new branch.
- Run `git status`. Note uncommitted changes that are not workflow files and
  mention them; do not touch them.

## 2. Pick the item

- From `blueprint/build-plan.md`: the ID or name the person gave, otherwise the
  first unticked item.
- If a Decision in the build plan's Decisions section blocks this item, stop and
  ask for that decision.
- State the chosen item in one sentence.

## 3. Gather a small packet

Follow "Efficient context and tool use" in `blueprint/context/ai-interaction.md`.
Read only what this item needs:

1. The item's line in the build plan and the review issues it cites in brackets.
2. The parts of `blueprint/project-plan.md` it depends on (users, data,
   constraints, UI).
3. Matching files in `blueprint/history/features/` when the item changes earlier
   work.
4. The real code: the entities, controllers, contracts, components and tests the
   item touches. Follow imports and callers; do not survey the whole repo.
5. The applicable sections of `blueprint/context/coding-standards.md`.
6. For UI that recreates a design, an image in `blueprint/reference/`. If none
   exists, ask for one.

The plans say what is wanted. The code says what exists. Never invent defaults,
limits, permissions, stored fields or API shapes. Put real product choices under
`Open questions`. If one blocks safe implementation, stop without writing the
spec and ask.

## 4. Size check

If the item will not fit in one PR of a few hundred lines, propose lettered
sub-items (for example 2.3a, 2.3b) with one line each. Wait for the person's OK,
add them under the parent in the build plan, then spec only the first.

## 5. Write the spec once

Use `reference/feature-spec-template.md`. Rules:

- **Branch:** the branch named in the build plan. If none, `feature/<kebab-title>`.
- **Audit:** `recommended` or `not needed`, with a one-line reason, from "When
  to recommend an audit" in `blueprint/context/ai-interaction.md`. It is advice
  for the person, never a gate.
- **Build steps:** ordered checkboxes. Each leaves the app working, is small
  enough to review, and ends with an observable *Done when* that names the check
  (a test name, an endpoint response, a screen state).
- **Testing:** name the tests each logic step adds (xUnit class and method,
  Vitest file), which ones need real Postgres, and what `/check` must observe in
  the running app.
- **Data / contracts:** new entities, columns, migrations, DTO and endpoint
  shapes, enum values, hub messages. Record anything later features must keep.
- **Security:** who may call each new endpoint or hub method, what owners can
  and cannot reach, what must never be logged.

## 6. Critique before writing

Check the draft for:

- Missing loading, empty, invalid, denied and unexpected-error states.
- A rule from the project plan, coding standards or `CLAUDE.md` that is missed
  or contradicted (acuity through `RecordTriage`, no cascade deletes, enums as
  text, owner scope, no PII in logs).
- Scope pulled in from a later build-plan item.
- A new abstraction, package or setting with no current need.
- A model change without a migration step, or an enum rename without a data update.
- A *Done when* nobody can observe, or a test the repo cannot run.

Fix what you find, then write the file.

## 7. Stop for review

Tell the person: the item, the branch, the number of steps, the Audit line, what
the critique changed, and any open questions. Approving a spec is a genuine
decision, so name the replies in one sentence: "OK and build" (Claude sets
`Status: approved` and follows `.claude/skills/ready/SKILL.md` in the same
turn), "OK only" (approve; `/ready` later), what to change, or "drop it"
(Claude resets `current-feature.md` to its stub). Then end ("Ending a turn" in
`blueprint/context/ai-interaction.md`):

- No blocking question: `Status: Spec prepared; awaiting your approval.`
  `Next: Reply "OK and build".`
- An open question blocks building: `Status: Spec prepared; one decision
  needed before building.` `Next:` the question, asked as a selection.
