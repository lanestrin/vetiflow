---
name: audit
description: Review the current branch diff against main for security, data, EF Core, testing and standards problems, and record findings with IDs and severities in blueprint/context/findings.md. Runs only when the person types /audit, /audit security, /audit tests or /audit focused (a re-check after a repair).
disable-model-invocation: true
---

# audit - review the branch and record findings

Read-only for product code. The only file this skill writes is
`blueprint/context/findings.md`. A clean audit does not prove the app works;
that is `/check`.

Runs only when the person asks for it (see "When to recommend an audit" in
`blueprint/context/ai-interaction.md`). No other skill starts it, and it starts
no other agents. `/clear` first is optional: a fresh context helps a large
review, but it is not required. If this session wrote the changes, say so in
the report.

## Input

- `/audit` or `/audit current`: the whole branch delta, all lenses.
- `/audit security`, `/audit data`, `/audit tests`, `/audit quality`: one lens.
- `/audit focused`: a re-check after a repair. Covers only the files changed
  since the last review, their callers and tests, regressions those changes
  could cause, and every `open` or `fixed` finding. All lenses apply to that
  scope.

## 1. Gather

- `git diff main...HEAD` plus uncommitted changes, and `git diff --stat`.
- `blueprint/context/current-feature.md` (the contract being reviewed).
- The applicable sections of `coding-standards.md` and the hard rules in `CLAUDE.md`.
- Existing `findings.md`, to avoid duplicates and to re-check `fixed` ones.

## 2. Run available signals

Run `scripts/verify.ps1 -ReuseIfCurrent` (see "Reusing a run" in `/verify`) and
report the scope and whether it reused or ran. Any FAIL or SKIP is a finding.

## 3. Review with these lenses

**Security**
- New endpoints and hub methods: sign-in required (once S.5 exists), right role.
- Owner access: only their own pet, never by case or patient ID alone.
- Input validation: unknown enum names and numbers rejected, lengths limited.
- Nothing sensitive in logs, errors or hub messages: owner contact details,
  intake notes, tokens, connection strings, stack traces.
- Secrets only in user secrets or environment variables.
- AI: owner details stripped before sending, intake notes treated as untrusted.

**Data and EF Core**
- Model change has a migration; `MigrationTests.Model_MatchesLatestMigration`
  passed in Verify's server tests.
- Enum renames update stored rows. No cascade deletes. Indexes match the rules.
- Queries: `AsNoTracking`, projection to DTOs, no N+1, active cases filtered by
  `DischargedAt IS NULL` where needed.
- Acuity set only through `RecordTriage`.
- Concurrency and conflicting updates handled where the spec says so.

**Tests**
- Every logic change has a test. Database rules are tested against real Postgres.
- Tests assert behaviour, not implementation details. No skipped or empty tests.
- Client tests query by role and label.

**Quality**
- Matches the spec: nothing missing, nothing extra.
- Follows `coding-standards.md`. No dead code, duplication or speculative layers.
- Accessible UI: keyboard, labels, `aria-live` where the spec requires it.

## 4. Record findings

Append to `blueprint/context/findings.md`, continuing the numbering:

```markdown
### F-03 [P1] open - Stage endpoint accepts numeric enum values
**Where:** `vetiflow.Server/Controllers/CasesController.cs:58`
**Problem:** `PATCH /api/cases/{id}/stage` with `"stage": 2` moves the case.
**Fix:** reject numbers in the enum converter; add a 400 test.
```

Severity:
- **P0** data loss, security break, or cannot ship.
- **P1** likely bug, broken contract, missing guard.
- **P2** maintainability problem worth fixing before the item closes.
- **P3** small cleanup or a follow-up idea.

Use P0 or P1 only with a concrete code path or a broken rule. When re-checking a
`fixed` finding, move it to `closed` if the repair holds, or back to `open`.
Never mark anything `accepted` on your own; only the person's choice can.
Lower a severity only after re-checking it against the code, and write the
evidence into the finding (`Lowered from P1: <what the re-check showed>`).

Every run, clean or not, ends the file with one line, so the history records
that the audit happened:

```markdown
Audit run <YYYY-MM-DD> on `<branch>` (<full|focused>): <n> new findings, <n> closed.
```

## 5. Report

List findings by severity with ID and title, say whether Verify ran or was
reused, then say whether `/complete` is blocked (any P0 or P1 `open` or
`fixed`). "Continue" below means `/ready` when the spec still has work or a
*Done when* needs the running app, otherwise `/complete`.

Then end ("Ending a turn" in `blueprint/context/ai-interaction.md`):

- **No findings, or only P3:** `Status: Audit complete; no blockers.`
  `Next:` continue. For P3s, say in one sentence that replying "repair F-NN"
  or "accept F-NN" is also possible.
- **A P2, none higher:** `Status: Audit complete; P2 F-NN worth fixing before
  this closes.` `Next: Reply "repair F-NN"` (Claude adds the repair step for
  your OK and builds it as `/ready` does). Mention "accept F-NN" and continuing
  in one sentence.
- **Any P0 or P1:** `Status: Blocked - F-NN <title>.` `Next: /ready` (it adds
  the repair steps, fixes them and runs Verify; then `/audit focused`).
  Mention that you can dispute a finding by saying why; Claude re-checks it
  with the code and keeps it or lowers it, giving the evidence.

Between work items, a finding is repaired with `/fix F-03` instead.
