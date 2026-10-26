---
name: ready
description: Take the approved spec to "ready for /complete" in one bounded loop - build any unticked steps, review in a fresh subagent, repair blocking findings, re-review, prove it - and stop for the person only at exceptions. Never runs /complete or /approve. Use for /ready.
disable-model-invocation: true
---

# ready - build, review and repair until ready for /complete

One command from an approved spec to a reviewable result. The person's input
stays at spec approval, exceptions and publication; routine repair and
re-review need no relay through them. This skill follows the other skills by
reading their files; it does not change them.

## Input

- `/ready`: the spec in `blueprint/context/current-feature.md`. Its `Status`
  must be `approved`, `in progress` or `verified`. An empty stub or
  `not started`: stop with the same options `/implement` section 1 gives.

## Rules

**Blocking findings:** P0 and P1, plus a P2 whose Problem names the *Done when*
or hard rule it breaks. Other P2 and P3 findings are follow-ups: listed in the
report, never marked `accepted` (only the person accepts).

**Continue without asking:**
- repairs needed to meet the approved spec, added as repair steps;
- regression tests for found defects;
- re-checking repairs through the reviewer;
- running affected tests, and reusing current Verify evidence;
- recording unrelated ideas as follow-ups in the report.

**Stop and ask** (report as "When something fails or stops" in
`blueprint/context/ai-interaction.md` says, listing the remaining blockers):
- a product choice or an ambiguous requirement;
- a change of scope or architecture, a new package, or a change to the spec
  other than a repair step;
- accepting a risk, or skipping a required check;
- a secret restriction or the hook blocking a command, or an external setup
  problem (Docker, network, the app will not start);
- the same failure after two repair attempts;
- a round that closes no blocker;
- the round limit reached (3 review rounds);
- anything that commits, pushes, merges or deploys.

Never weaken, skip or delete a test, and never change a severity, to finish.
Only the reviewer may lower a severity, with its evidence written in the
finding; this skill reports that it happened.

## 1. Build

First, every time, apply the branch check from
`.claude/skills/implement/SKILL.md` section 2 (the exact `**Branch:**`, never
`main`, the "Unexpected files" stop), even when there is nothing to build:
repairs in section 3 must not land on the wrong branch.

Then follow `/implement` sections 2-5 for any unticked steps, including its
stops. Skip that when every step is ticked and the spec is `verified`; its
`Status` changes only when there is work.

## 2. Review

Each round is a new general-purpose subagent (the Agent tool with no
`subagent_type`, or `general-purpose`), never a fork of this session: the
reviewer must not have written the code. Its prompt says:

- follow `.claude/skills/audit/SKILL.md` as a reviewer started by `/ready`, in
  the mode for this round, writing only `blueprint/context/findings.md`;
- the round number, and for a focused round the files the repairs changed
  since the last review (this session made those edits, so it lists them) and
  the finding IDs still `open` or `fixed`;
- return the summary that `/audit` defines for `/ready`.

Rounds:
- **Round 1:** full.
- **Rounds 2 and 3:** focused, after a repair.
- **Final:** when a focused round finds no blocker, one full review of the
  combined change. A blocker it finds starts the next round, if one is left;
  otherwise stop at the limit. A full round with no blocker needs no final.

Read `findings.md` after each round; do not rely on the summary alone.

## 3. Repair

For each blocking finding, in severity order:

1. Add a repair step to the spec (`- [ ] **Step N - repair F-NN: <title>.**`
   with a *Done when*) without asking, and set `Status` to `in progress`.
2. Build it per `/implement` section 3: failing test first, the narrow check
   (or the broader suite it lists), tick the step, mark the finding `fixed`.

Then run `/verify` once (fresh, as `/implement` section 5 does) and set
`Status` to `verified` when it passes. A repair that needs anything on the stop
list stops the loop instead. Then the next review round.

## 4. Prove it

When a *Done when* needs the running app, follow
`.claude/skills/check/SKILL.md`. A setup problem is a stop, not a failure to
repair.

## 5. Report

One block per round, then the state:

```
Round 1/3: full review - 1 blocker (F-26 P1)
Round 2/3: repaired F-26; focused review - blocker closed
Final: full review - no blockers
Checks: affected tests passed; full Verify reused
Remaining: one non-blocking follow-up (F-27 P3)
State: ready for /complete
```

Add any severity a reviewer lowered, with its reason, and whether `/check` ran.

**Independent review.** When the spec's work is phase S or 8, migrations or
stored data, a hard rule, or a workflow skill's safety checks (see "Independent
review" in `ai-interaction.md`), the state is "needs a session audit", and the
next step is `/clear`, then `/audit`, then `/complete`. Otherwise the next step
is `/complete`, then `/approve`.

Never commit, push or merge from this skill.
