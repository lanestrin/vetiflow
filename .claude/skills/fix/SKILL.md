---
name: fix
description: Write a short spec in blueprint/context/current-feature.md for a bug or small unplanned change, or for a finding ID like F-03, then stop for review. Use for /fix, confirmed bugs, and small changes that are not build-plan items.
disable-model-invocation: true
---

# fix - spec a bug or small change

A fix runs the same loop as a feature (`/implement`, `/verify`, `/complete`) but
starts here, is lighter, and is archived to `blueprint/history/fixes/`. It is
never added to the build plan.

## Input

- A description: `/fix "board shows discharged patients in the count"`.
- Or a finding ID from `findings.md`: `/fix F-03`. Only between work items,
  because this overwrites `current-feature.md`. While a spec is active, repair
  findings through `/implement` instead.
- If the cause is not known yet, run `/debug` first.

## Preflight

`current-feature.md` must be the empty stub. If not, stop and offer the same
choice as `/feature` step 1: finish the current spec first (Recommended), or
drop it. Then delete stale landing drafts as `/feature` step 1 does.

## Write the spec

First heading `# Fix: <title>`, then:

- **Type:** Fix
- **Status:** not started
- **Branch:** `fix/<kebab-title>`
- **Audit:** `required` or `not needed`, with a one-line reason, from "When to
  audit" in `blueprint/context/ai-interaction.md`. A fix that adds a missing
  auth, owner-scope or redaction check is `required`.
- **Fixes:** `<finding ID>` (only when fixing a finding)
- **The problem:** what is wrong, where (file and line), and how to reproduce it.
- **The fix:** the root-cause repair and what it must not break. Adding a
  missing auth, owner-scope, validation or redaction check is a root-cause
  repair, not new machinery.
- **Build steps:** usually one. *Step 1 - failing test* first when the bug can
  be tested, then *Step 2 - fix*. Each with a *Done when*.
- **Verify:** the test that proves it and what to observe in the app.

## Rules

- If it turns out to be a feature, stop and suggest a build-plan item instead.
- Same conventions as everything else (`coding-standards.md`).

Then stop and offer the same choice as `/feature` step 7: OK the spec
(Recommended; Claude sets `Status: approved`, then type `/implement`), change
it, answer open questions first, or drop it.
