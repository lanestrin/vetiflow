# Fix: Audit only on request, `/ready` as the default build path, readable-code guidance

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/audit-on-request`
- **Audit:** `not needed` - workflow skills and docs only. Under the new policy this spec introduces, that is the rule, and the person asked for no audit or self-review on this change.

## The problem

The workflow sends the person through reviews and handoffs they did not ask
for, and the paths contradict each other:

1. **Mandatory audits.** "When to audit" in `blueprint/context/ai-interaction.md`
   makes `/audit` `required` for whole classes of work, workflow skills
   included, and `/complete` gate 5 (`.claude/skills/complete/SKILL.md:39-50`)
   refuses to finish without an `Audit run` line. Today that is a `session`
   line written after `/clear`.
2. **Reviewer subagents by default.** `/ready` (`.claude/skills/ready/SKILL.md`,
   section 2) starts a fresh reviewer subagent on every round and loops up to 3
   rounds. The person never asked for that.
3. **`/clear` as a gate.** The loop, `/implement`'s review packet
   (`implement/SKILL.md:101-102`), `/status` (`status/SKILL.md:37-40`),
   `/audit`'s report and `/complete` gates 4-5 all send the person through
   `/clear`, then `/audit`, as a routine step.
4. **Manual build relay.** `/feature` and `/fix` end with "OK it, then type
   `/implement`". After that, `/implement`'s packet offers `/clear` + `/audit`,
   `/check`, `/complete` or `/ready`: four paths for one decision.

## The fix

**Review policy** (replaces "When to audit" and "Independent review" in
`ai-interaction.md`):

- The spec's `**Audit:**` line becomes `recommended - <reason>` or
  `not needed - <reason>`. There is no `required`.
- `recommended`: the work changes application code (`vetiflow.Server/`,
  `vetiflow.client/src/`), database behaviour (entities, `Data/`, migrations,
  stored data) or application config (`Program.cs`, `appsettings*.json`,
  `vite.config.ts`, the server `Dockerfile`). The reason names what is risky,
  for example phase S or 8, sign-in, owner access, AI input or a diff over
  about 400 lines.
- `not needed`: Claude skills, workflow instructions, docs, scripts and other
  tooling, workflow safety instructions included.
- `/audit` runs only when the person types it. Claude never starts it, never
  starts a reviewer subagent, and adds no self-review phase. A recommendation
  is shown in the readiness report and the review packet. It never blocks
  `/complete` and never needs `/clear`.
- A blocker from an audit the person asked for still counts. P0 or P1 findings
  that are `open` or `fixed` block `/complete` (gate 4, unchanged). `/ready`
  repairs them as repair steps. A `fixed` blocker closes only through a re-check
  with `/audit focused`, which the person types.
- `/clear` is optional context management, suggested only for a large next
  task. It is never a gate.

**`/ready` is the default after spec approval.** `/feature` and `/fix` offer
"OK and build" first: Claude sets `approved` and follows `/ready` in the same
turn. "OK only" stays as an option. `/ready`:

1. Runs the branch check (`/implement` section 2) every time.
2. Builds the unticked steps per `/implement` sections 3-5, including the narrow
   and broader checks and one fresh Verify. It repairs in-scope test, lint and
   build failures itself, within `/implement` section 5's limit (stop after 2
   failed attempts on the same failure).
3. Turns `open` P0/P1 findings from a requested audit into repair steps and
   builds them (no new OK, as `CLAUDE.md` already allows).
4. Runs `/check` when a *Done when* needs the running app.
5. Reports readiness concisely: steps built, checks with real results, Verify
   ran or reused, `/check` result, open findings, and the audit recommendation
   for application changes. It stops before `/complete`.

It stops and asks for: a product decision or ambiguous requirement, a material
scope or architecture change (a new package included), a secret restriction or
the hook blocking a command, an external setup problem (Docker, network, the
app will not start), an exhausted retry limit, or anything that commits,
pushes, merges or deploys. No review stage, no subagents, no round limit.

**Per file:**

- `CLAUDE.md`: the loop line and command table show `/ready` as the default,
  `/audit` "on request", `/clear` optional. The "Spec before code" exception
  covers repair steps for blockers from a requested audit.
- `ai-interaction.md`: rewrite the loop (step 2 `/ready`, or `/implement` to go
  step by step; step 3 "Audit, only on request"). Replace "When to audit" with
  "When to recommend an audit". Delete "Independent review". Update the
  `/ready` paragraph and the "Choosing the next step" bullets.
- `/feature`, `/fix`, `feature-spec-template.md`: the new Audit line values,
  and "OK and build" as the first option.
- `/implement`: section 3.2 sets `recommended` when the work grows into
  application code. The section 6 packet's first option is the next step
  (`/check` when the app is needed, otherwise `/complete`), with the
  recommendation shown and `/audit` offered as an option, not a step.
- `/ready`: rewritten as above.
- `/audit`: "runs only when the person types it". `/clear` first is optional.
  Remove the `/ready` subagent mode and return format, and the `session|subagent`
  part of the `Audit run` line (it becomes `(<full|focused>)`). `focused` stays,
  for re-checking repairs. Report options: repair with `/ready`, then
  `/audit focused`.
- `/status`: drop the `session`/`subagent` and "Audit required" rows. Approved
  or in progress -> `/ready`. Open P0/P1 -> `/ready`. Fixed P0/P1 ->
  `/audit focused`. Verified -> `/check` or `/complete`, noting the
  recommendation.
- `/complete`: remove gate 5 (renumber Files to 5). Gate 4's fixed-finding
  path becomes `/audit focused` (no `/clear`). The result template's Audit line
  becomes `<not needed | recommended, not run | run on request: findings closed>`.
- `/approve`: the after-merge row makes `/clear` optional.

**Kept unchanged:** spec approval before code, `disable-model-invocation: true`
on every workflow skill and its guard test (the person's "OK and build" choice
is what starts `/ready`), the secret deny rules, hook and `.env` rules,
`db-target.ps1`, the `/approve`-only commit and push, Verify and its reuse rule,
the "never weaken a test" rule, `/implement`'s scope check before Verify
(section 4: acceptance criteria against the diff), and the history files
(final once merged).

**Must not break:** the manual path still works (`/implement` step by step,
`/audit` whenever the person wants one). Every skill that suggests a next
command points along the same path.

## Scope change: readable code and one place per policy

Added at the person's request and OK'd by them (2026-10-25). Nothing here adds
a command, a skill, a script or a gate.

1. **Readable application code.** A new "Readable code" section in
   `coding-standards.md`, folded into the existing "Proportional engineering"
   section rather than set beside it. It covers: domain names and framework
   conventions; one responsibility per function, class and component; plain
   control flow over dense chains; related logic kept together, with helpers
   only when they clarify intent, isolate a responsibility or remove
   meaningful duplication; visible side effects and business rules; comments
   for non-obvious decisions; tests with clear arrange, act and assert. Against
   overengineering: no length limits or swarms of tiny methods; no interface,
   layer, factory, generic utility, package or pattern without a current
   benefit; SOLID for real design problems, not as a checklist; look-alike code
   is not automatically an abstraction; no style refactors of unrelated code;
   simplicity never weakens security or correctness. `CLAUDE.md` points to it.
2. **No self-review step.** Remove `/implement` step 3.6 ("Self-review the
   diff"). The security items it listed already live in `coding-standards.md`
   (Security), which step 3.2 follows while writing the code.
3. **Known defects and failed checks block, however found.** Under "When to
   recommend an audit": a defect Claude finds while building is in scope (fix
   it, with a regression test). Outside the spec, it stops `/ready` as a scope
   question. A failed or skipped required check blocks (Verify gate, unchanged).
   Never waive a risk, suppress a finding or lower a severity to finish.
4. **Bounded repair loop.** `/ready` stops when the same failure persists after
   `/implement` section 5's limit, or when a repair attempt changes nothing
   (no progress). It reports progress at milestones: each step built, each
   repair, Verify ran or reused, `/check` result.
5. **One responsibility per skill, one home per policy.** A short "Who does
   what" table in `ai-interaction.md` (spec, `/implement`, `/verify`, `/audit`,
   `/ready`, `/complete`, `/approve`, `/status`). The other files link to the
   loop, review policy, reuse rule and failure handling instead of restating
   them. This round trims the restatements in the skills already being edited;
   it does not rewrite unrelated skills.
6. **No wording tests.** Drop `scripts/tests/workflow-policy.tests.ps1`
   (former Step 1). It only checked phrasing. `skill-guards.tests.ps1` stays: it
   checks real frontmatter that controls behaviour.

**Not in scope:** CI changes (CI already runs server and client tests on every
PR; running `verify.ps1` there is hardening slice C), new sandboxing, deployment,
application code changes.

## Scope change: explicit completion and handoff

Given by the person as a direct instruction (2026-10-25), which is their OK.

- "Ending a turn" in `ai-interaction.md` replaces "Choosing the next step":
  every task and command ends with `Status: <state>` and `Next: <one action>`.
  One recommended action, not a menu. A question only for a genuine decision.
  No vague endings. Exact state names (implementation complete, verification
  passed, publication prepared, committed, pushed, PR opened, merged), never a
  later one. The audit recommendation goes on its own line, never as `Next`.
  While `/ready` works: milestone lines only, with the handoff at the end.
- "When something fails or stops" ends with `Status: Blocked - <reason>.`.
- Each skill names its usual `Status` and `Next` and links to the section:
  `/feature`, `/fix`, `/implement`, `/ready`, `/audit`, `/check`, `/complete`,
  `/approve`, `/status`, `/verify`, `/brief`, `/debug`. `CLAUDE.md` gets a
  one-line pointer.

## Build steps

- [x] **Step 1 - policy text.** `ai-interaction.md` (loop, `/ready` default,
  `/clear` optional, "When to recommend an audit") and `CLAUDE.md` (loop line,
  command table, repair-step exception).
  *Done when:* neither file makes an audit mandatory, requires `/clear`, or
  mentions reviewer subagents.

- [x] **Step 2 - scope change text.** `coding-standards.md` "Readable code";
  `ai-interaction.md` "Who does what" table and the known-defect rule;
  `CLAUDE.md` pointer to the readable-code section. Delete
  `scripts/tests/workflow-policy.tests.ps1`.
  *Done when:* each policy (loop, review, reuse, failure handling, readable
  code) has one home, and the others link to it.

- [x] **Step 3 - skills.** `/feature`, `/fix`, the spec template, `/implement`
  (no step 3.6), `/ready` (bounded loop and milestone progress), `/audit`,
  `/status`, `/complete` (plus its result template) and `/approve`, as in "The
  fix" and this scope change.
  *Done when:* `skill-guards.tests.ps1` passes, and a read-through of each
  skill's next-step text gives one path: spec -> OK and build (`/ready`) ->
  `/complete` -> `/approve`, with `/audit` only on request and `/clear` never
  required.

- [x] **Step 4 - Verify.** Full `scripts/verify.ps1`.
  *Done when:* it passes (fresh run, since the fingerprint changed).

- [x] **Step 5 - Status and Next handoff.** As in "Scope change: explicit
  completion and handoff".
  *Done when:* no skill ends with an option menu by default, every skill's
  ending names a `Status` and one `Next`, and a full Verify passes.

- [x] **Step 6 - two wording fixes** (the person's instruction, 2026-10-25).
  `/ready` section 2 runs `scripts/verify.ps1 -ReuseIfCurrent` instead of a
  forced fresh Verify; the Result template's `Shipped ... squash-merged` line
  becomes `Prepared: branch <branch>, verified and awaiting publication.`
  *Done when:* the workflow tests pass; `/complete` gate 3 then reruns or
  reuses Verify by the evidence rule.

## Verify

- `skill-guards.tests.ps1` and the other workflow tests (in Verify's Workflow
  tests).
- Full `scripts/verify.ps1` in Windows PowerShell 5.1 (`pwsh` is not installed).
- A grep across `CLAUDE.md`, `blueprint/context/` and `.claude/skills/` for
  `required`, `subagent`, `Independent review`, `/clear` and `Self-review`,
  read by hand (not a test).
- No `/check`: nothing changes in the running app. No `/audit`, as the person
  asked.

## Decisions (the person, 2026-10-25)

1. **What starts `/ready`:** choosing "OK and build" on the spec starts it in
   the same turn. "OK only" just sets `approved`.
2. **Closing a repaired blocker:** a `fixed` P0/P1 from a requested audit needs
   `/audit focused` before `/complete`.

## Result

- **Prepared:** branch `fix/audit-on-request`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` on 2026-10-25 (ran: files had changed since the last evidence; Windows PowerShell 5.1, `pwsh` is not installed)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** not run (no running-app behaviour changes). A grep across `CLAUDE.md`, `blueprint/context/` and `.claude/skills/` found no remaining mandatory-audit, reviewer-subagent, `/clear`-gate, self-review or "Shipped" wording.
- **Audit:** not needed (workflow skills and docs only); none run, as the person asked.
- **Follow-ups added to build plan:** none. F-28 and F-30 [P3] from `2026-10-25-verify-evidence.md` remain for `/fix`; this branch covers F-31 (the Result template records a reused Verify).
- **Deploy notes:** none.
