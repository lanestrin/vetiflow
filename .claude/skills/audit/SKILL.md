---
name: audit
description: Review the current branch diff against main for security, data, EF Core, testing and standards problems, and record findings with IDs and severities in blueprint/context/findings.md. Use for /audit, /audit security, /audit tests, or before completing risky work.
disable-model-invocation: true
---

# audit - review the branch and record findings

Read-only for product code. The only file this skill writes is
`blueprint/context/findings.md`. A clean audit does not prove the app works;
that is `/check`.

## Input

- `/audit` or `/audit current`: the whole branch delta, all lenses.
- `/audit security`, `/audit data`, `/audit tests`, `/audit quality`: one lens.
- For security-sensitive work (build plan phase S or 8, owner page, AI data),
  recommend running this in a fresh Claude session that did not write the code.

## 1. Gather

- `git diff main...HEAD` plus uncommitted changes, and `git diff --stat`.
- `blueprint/context/current-feature.md` (the contract being reviewed).
- The applicable sections of `coding-standards.md` and the hard rules in `CLAUDE.md`.
- Existing `findings.md`, to avoid duplicates and to re-check `fixed` ones.

## 2. Run available signals

`/verify` output if it ran in this session; otherwise run
`pwsh -File scripts/verify.ps1`. Failing checks are findings.

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
- Model change has a migration; `has-pending-model-changes` is clean.
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
Never mark anything `accepted`; only the person can.

## 5. Report

List findings by severity with ID and title, then say whether `/complete` is
blocked (any P0 or P1 `open` or `fixed`). Repairs go through `/implement` as
new spec steps, or `/fix F-03` between work items.
