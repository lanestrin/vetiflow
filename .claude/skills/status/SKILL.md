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
- **Active work:** spec title, status, "step 3 of 5 done", the `**Audit:**`
  recommendation and whether an `Audit run` line exists, or "nothing in
  progress".
- **Findings:** for example "1 P1 open, 2 P3 open", and whether `/complete` is blocked.
- **Working tree:** clean, or the changed files grouped by area. Flag changes
  that do not belong to the active spec.
- **Plan progress:** for example "6 of 70 items done", and the next unticked item.
- **Drift warnings:** spec says `verified` but files changed since; work on
  `main`; a ticked build-plan item with no history file. An item has one when a
  file in `blueprint/history/` is named for its ID or names the ID in its
  `From build-plan` line (1.3 shipped inside 1.2's file).
- **Next command**, following the loop in `blueprint/context/ai-interaction.md`:

  | State | Next |
  | --- | --- |
  | No spec, on `main` | `/feature` (next item) or `/fix "<what>"` |
  | Spec `not started` | Read it, then "OK and build" (runs `/ready`), OK only, or change it |
  | Spec `approved` or `in progress` | `/ready` (resumes at the first unticked step) |
  | Open P0/P1 findings | `/ready` (adds and builds the repair steps), then `/audit focused` |
  | `fixed` P0/P1 findings, none open | `/audit focused` |
  | `verified`, a *Done when* needs the app, not yet checked | `/check` (or `/ready`, which runs it) |
  | `verified`, ready | `/complete` (the Audit line may recommend an optional `/audit` first) |
  | On a work branch (not `main`), stub spec, a history file with ``**Branch:** `<current branch>` ``, `landing-commit.txt` present, uncommitted changes | `/approve` |
  | Pushed, PR open | Merge on GitHub when CI is green |

  When more than one row fits, pick the safer one (for example `/check` before
  `/complete` when it is unclear whether the app needs checking).

End with the handoff ("Ending a turn" in `blueprint/context/ai-interaction.md`):
`Status:` the state in a few words (for example "Spec verified; app check
pending.") and `Next:` the command from the table.
