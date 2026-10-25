---
name: status
description: Read-only summary of where VetiFlow work stands - current branch, active spec and its ticked steps, open findings, uncommitted changes, and the next build-plan item - with the suggested next command. Use for /status or "where did we leave off".
---

# status - where are we?

Read-only. Writes nothing.

## Gather (one batch)

- `git branch --show-current`, `git status --short`, `git log --oneline -5`
- `blueprint/context/current-feature.md`: title, `Status`, ticked and unticked steps
- `blueprint/context/findings.md`: count by severity and status
- `blueprint/build-plan.md`: ticked count, the first unticked item

## Report

- **Branch:** name, and whether it matches the spec's `**Branch:**`.
- **Active work:** spec title, status, "step 3 of 5 done", or "nothing in progress".
- **Findings:** for example "1 P1 open, 2 P3 open", and whether `/complete` is blocked.
- **Working tree:** clean, or the changed files grouped by area. Flag changes
  that do not belong to the active spec.
- **Plan progress:** for example "6 of 70 items done", and the next unticked item.
- **Drift warnings:** spec says `verified` but files changed since; work on
  `main`; a ticked build-plan item with no history file.
- **Next command:** one, for example `/implement` (resume at step 4),
  `/audit`, `/complete`, or `/feature 0.2`.
