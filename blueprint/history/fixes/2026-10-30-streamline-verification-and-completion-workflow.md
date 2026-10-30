# Fix: Streamline verification and completion workflow

**Type:** Fix
**Status:** complete
**Branch:** `fix/streamline-verification-and-completion-workflow`
**Audit:** not needed - workflow instructions only; no application or verification-script changes.

## The problem

The workflow already selects checks by changed files and reuses current Verify
evidence, but its instructions still require avoidable repeated work:

- `.claude/skills/implement/SKILL.md:56-66` requires a narrow check or an
  entire affected suite for each step. Section 5 at line 80 then requires a
  fresh Verify. On the final step, the broad suite can run twice without an
  intervening edit. Reproduce by following a final step that changes shared
  application code: run the affected suite, then Verify runs that suite again.
- `.claude/skills/ready/SKILL.md:59-75` follows `/implement` through final
  Verify before repairing audit blockers, then invokes Verify again. Evidence
  reuse avoids a second test run only when no repair changed the files.
  Reproduce with an approved spec containing unticked steps and an open P1:
  Verify runs before the repair, which invalidates its evidence.
- `.claude/skills/complete/SKILL.md:30-43` checks Verify before findings and
  unexpected files. With stale evidence and a blocking finding, it runs checks
  before reporting a blocker it could have identified immediately.
- `/implement`'s no-logic fallback still suggests application lint or build for
  workflow-only edits. `/complete` also prints the full commit message even
  though the reviewable draft already contains it. These add checks and output
  without new evidence.
- `/feature` already asks for a small reading packet, but the shared workflow
  lacks an explicit rule for reusing unchanged instructions within a session.
  The build plan is about 70 KB; rereading it and unrelated history at each
  handoff increases context without helping the current change. `/status` needs
  counts and matching lines, not the full plan/history contents in chat context.

## The fix

Make the existing checks serve the workflow once at the right point, and keep
completion a short evidence-backed handoff.

- Keep regression tests and useful narrow checks during development. On the
  final build or repair step, allow final Verify to satisfy the step's required
  broad check when its scope includes that check and no further edits intervene.
  Do not tick that step until Verify passes. Earlier steps retain their checks.
- When `/ready` coordinates the work, finish build steps and in-scope audit
  repairs before final Verify. Follow `/implement`'s build rules without invoking
  its standalone final Verify or handoff in the middle. `/ready` owns the final
  Verify and report; standalone `/implement` still verifies and reports.
- `/verify` remains a fresh run when explicitly requested. Later gates continue
  to use `scripts/verify.ps1 -ReuseIfCurrent`; only that script can decide reuse.
  A manually run test suite alone is never sufficient Verify evidence.
- `/complete` checks spec, branch, findings and file scope before Verify, then
  archives and writes the complete commit and PR drafts. Its bookkeeping does
  not trigger another test run. Report the verification scope and whether it
  ran or was reused, link the archive and drafts, and give one next action.
- Update cross-references and summaries so the check policy has one owner and
  the skills agree about standalone versus coordinated execution.
- Extend the existing small-packet rule across the workflow: use path/heading
  searches and bounded sections, read matching history and relevant callers,
  and reuse instructions already read when unchanged. Refresh branch, diff,
  spec, findings and evidence at their decision gates; never substitute cached
  prose for current repository state. After context loss, reload the packet.
- Match development checks to the changed artifact. Workflow/docs-only steps
  use a diff/instruction check and final workflow Verify, rather than an
  unrelated application lint/build. Logic changes retain behavior tests,
  regression tests for bugs, and required broader coverage for shared code,
  security, configuration and data changes. Avoid tests that merely match prose.
- Use brief milestone updates and one final report per coordinated command.
  Keep full evidence and publication content in their existing files; link them
  from chat and report the outcome, checks, limitations and next action. Expand
  failures and decisions when needed. Preserve the full file/message preview at
  `/approve` and its PR-content checks. No additional summary/cache artifact.
- Batch independent reads and wait for long-running checks in sensible intervals
  (about 20-30 seconds, adjusted to the command), with timely user updates.
  Inspect a failing log once, then follow the relevant code path; avoid repeated
  whole-log dumps or immediate empty polls.

**Must preserve:** failed/skipped checks block completion; stale or insufficient
evidence causes a run; P0/P1 findings remain blockers until confirmed closed;
only the person invokes `/complete`, `/approve` and `/audit`; spec approval,
branch rules, secret protections and CI checks remain intact. All required
commit/PR content remains in the drafts.

## Build steps

- [x] **Step 1 - remove duplicate verification instructions.** Update
  `/implement`, `/ready` and `/verify` to describe the final-step check rule and
  who runs final Verify. Align `blueprint/context/ai-interaction.md` and
  `CLAUDE.md` where necessary. *Done when:* walking through standalone
  `/implement`, `/ready` with builds and repairs, and `/ready` with nothing to
  build gives each one final Verify invocation after the last edit; final-step
  broad checks are satisfied by its actual results; an explicit `/verify`
  remains fresh. Workflow-only work does not run unrelated application checks.
  Failure paths leave unfinished steps unticked.
- [x] **Step 2 - streamline completion and verify consistency.** Reorder
  `/complete` preflight checks, shorten its handoff while retaining reviewable
  drafts, and fix affected gate-number references. *Done when:* an invalid spec,
  wrong branch, P0/P1 blocker or unexpected file stops before Verify and before
  archiving; a valid completion uses current evidence or runs missing checks,
  writes the archive and complete drafts, and ends with `Next: /approve`.
  Existing workflow tests pass, and `/approve` still independently checks the
  current evidence before publishing.
- [x] **Step 3 - use focused context and concise reports.** Add the shared
  reading/output rules to `ai-interaction.md`; align `/feature`, `/status`,
  `/implement`, `/ready` and `/complete` through short references rather than
  repeating policy. *Done when:* a walkthrough of planning, resuming, status,
  completion and approval loads only relevant sections and current gate facts;
  unchanged instructions need not be reread within a session; context loss or
  changed files cause relevant rereads. Reports retain real results and material
  limitations, link full drafts, and keep the publication preview intact.

## Files / areas

- `.claude/skills/implement/SKILL.md`, `ready/SKILL.md`, `verify/SKILL.md`,
  `complete/SKILL.md`, `feature/SKILL.md`, `status/SKILL.md`.
- `blueprint/context/ai-interaction.md`, `CLAUDE.md`; cross-references in
  `.claude/skills/approve/SKILL.md` only if needed.
- No changes to application code, test selection, evidence fingerprints,
  PowerShell scripts, CI, packages or the build plan. No new document-text tests.

## Verify

- Review instruction paths for: final broad check, standalone implementation,
  coordinated build plus audit repair, already-verified work, stale evidence,
  failed Verify, blocking findings, wrong branch and unexpected files. Record
  this as an instruction walkthrough, not an executed end-to-end command.
- Run `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1` after the
  instruction changes. Expected scope: `workflow`; report the real output.
- Run the same command with `-ReuseIfCurrent` immediately afterward to confirm
  current passing evidence is reused. Preserve existing evidence/scope and
  person-only skill regression checks.
- Check `git diff --check` and search affected instructions for stale gate
  references and contradictory fresh/reuse requirements.
- Compare the instruction diff for unnecessary repetition. Record actual check
  commands and whether evidence was reused; do not claim token or elapsed-time
  savings without comparable measurements. Keep script/CI optimization as a
  separate follow-up requiring profiling, not part of this instruction change.
- Running-app check: not needed; no application behavior changes.

## Open questions

None. This proposal treats streamlining as removing repeated workflow work,
without changing the checks themselves or the person's approval boundaries.

## Build evidence

- Instruction walkthrough: standalone implementation verifies once; coordinated
  builds and known repairs finish before final Verify. Final broad-check steps
  stay unticked on failure; a repaired P0/P1 stays blocked pending confirmation.
- Instruction walkthrough: verified work rechecks branch and script-managed
  evidence; stale or insufficient evidence runs checks. Explicit `/verify`
  remains fresh. Spec, branch, findings and file blockers precede completion's
  Verify; archive and complete drafts follow only after all gates pass.
- Instruction walkthrough: planning/status use targeted plan and history reads;
  context loss, changed instructions or uncertain freshness reload the packet.
  Reports link drafts; approval retains its full preview and independent checks.
  These are instruction walkthroughs, not executed end-to-end workflow commands.
- `git diff --check` passed during each instruction-edit step. No application
  checks were needed for these documentation-only edits.
- Verify on 2026-10-30: `powershell -NoProfile -ExecutionPolicy Bypass -File
  scripts/verify.ps1` ran fresh, scope `workflow` (9 changed workflow/docs files).
  PASS Workflow tests; server and client steps Not needed. The immediate run
  with `-ReuseIfCurrent` reused that PASS from `2026-10-30T23:50:01.9071607Z`
  on this branch at `13277db`. No test was skipped or disabled.
- App check not needed; no application behavior changed. Audit not needed and
  not run. No comparative token/time benchmark was performed.

## Result

- **Prepared:** branch `fix/streamline-verification-and-completion-workflow`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` on 2026-10-30, scope `workflow` (reused from `2026-10-30T23:50:01.9071607Z`, this branch @ `13277db`; fresh run followed the last instruction edit).
  - PASS Workflow tests (449 checks across seven existing suites).
  - Not needed: server steps (no server files changed).
  - Not needed: client steps (no client files changed).
- **Check:** not run; workflow instructions only, with no running-app behavior. Instruction walkthroughs covered standalone/coordinated builds, final-step checks, repairs, resuming, evidence reuse, completion blockers and publication previews; these were not end-to-end executions.
- **Audit:** not needed; workflow instructions only. Not requested or run; no findings recorded.
- **Follow-ups added to build plan:** none. Profiling test startup remains a possible separate task.
- **Deploy notes:** none.
- **Limits:** no comparative token or elapsed-time benchmark. `git diff --check` passed; CI has not run for this change.
