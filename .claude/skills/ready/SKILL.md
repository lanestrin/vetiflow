---
name: ready
description: Take the approved spec to "ready for /complete" in one run - build any unticked steps, repair in-scope failures, repair blockers from an audit the person asked for, run Verify and /check - and stop for the person only at exceptions. Never audits, never runs /complete or /approve. Use for /ready, or after the person chooses "OK and build" on a spec.
disable-model-invocation: true
---

# ready - build, repair and check until ready for /complete

The default path after spec approval. The person types `/ready`, or chooses
"OK and build" when `/feature` or `/fix` offers the spec; either way they asked
for it. This skill follows the other skills by reading their files; it does not
change them. It adds no review stage: no `/audit`, no reviewer agents, no
self-review phase.

## Input

- `/ready`: the spec in `blueprint/context/current-feature.md`. Its `Status`
  must be `approved`, `in progress` or `verified`. An empty stub or
  `not started`: stop with the same options `/implement` section 1 gives.

## Rules

**Continue without asking** (routine work inside the approved scope):
- building every unticked step, with its tests;
- repairing in-scope test, lint and build failures, and defects found while
  building (with a regression test);
- repair steps for `open` P0/P1 findings from an audit the person asked for;
- running affected tests, and reusing current Verify evidence;
- recording unrelated ideas as follow-ups in the report.

**The repair loop is bounded.** Stop when the same failure is still there after
`/implement` section 5's limit (2 or 3 attempts), or when a repair attempt
changes nothing.

**Stop and ask** (report as "When something fails or stops" in
`blueprint/context/ai-interaction.md` says):
- a product choice or an ambiguous requirement;
- a material change of scope or architecture, a new package, or a change to
  the spec other than a repair step;
- accepting a risk, or waiving or skipping a required check;
- a secret restriction or the hook blocking a command;
- an external setup problem (Docker, network, the app will not start);
- the repair loop's limit reached, or no progress;
- anything that commits, pushes, merges or deploys.

"Real problems block" in `ai-interaction.md` and its Safety section always
apply: never weaken a test, a secret restriction or a Verify gate, and never
change a finding's severity or status beyond marking a repair `fixed`.

**Progress:** one short line at each milestone (a step built, a repair made,
Verify ran or reused, `/check` result). No narration of routine passes.

## 1. Build

First, every time, apply the branch check from
`.claude/skills/implement/SKILL.md` section 2 (the exact `**Branch:**`, never
`main`, the "Unexpected files" stop), even when there is nothing to build.

Then follow `/implement` sections 3-4 for any unticked steps, including their
stops and checks. Skip its standalone final Verify and report: this command
owns both after the repairs below. Read current findings before building so
known repairs count when identifying the final step. Only the final step across
builds and known repairs may defer its broad check to final Verify. Skip building
when every step is ticked; the branch, findings and Verify checks still apply.

## 2. Repair blockers from a requested audit

Read `blueprint/context/findings.md`. For each `open` P0 or P1, in severity
order:

1. Add a repair step to the spec (`- [ ] **Step N - repair F-NN: <title>.**`
   with a *Done when*) without asking, and set `Status` to `in progress`.
2. Build and check it per `/implement` section 3, including its final-step
   deferral rule. Tick the step and mark the finding `fixed` only after its
   required check passes.

After all builds and repairs, apply `/implement` section 4 and run final Verify
once using `/verify`'s invocation policy. Follow `/implement` section 5's failure
loop and status rules, including ticking a step awaiting its broad check only
after it passes. A `fixed` finding stays a `/complete` blocker until the person
runs `/audit focused` and it closes.

## 3. Prove it

When a *Done when* needs the running app, follow
`.claude/skills/check/SKILL.md`. A setup problem is a stop, not a failure to
repair.

An in-scope app-check failure returns to the build/repair loop, then final
Verify and the affected app check again. Report only the final readiness state.

## 4. Report

Give one concise report per "Ending a turn" in `ai-interaction.md`: link the
spec, name built/repaired steps, actual checks (Verify scope, ran or reused,
result), app-check outcome or why unnecessary, findings and material limitations.
Give the spec's Audit recommendation separately; a recommended audit is optional.

- ready: `Status: Implementation complete; verification passed; ready to archive
  and prepare publication.` `Next: /complete`
- a `fixed` P0/P1 waiting: `Status: Implementation complete; verification
  passed; repaired blocker F-NN awaits confirmation.` `Next: /audit focused`
- a stop: `Status: Blocked - <reason>.` `Next:` the action or decision needed.

Never commit, push or merge from this skill.
