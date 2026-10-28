# Fix: Wait chip shows New for cases still awaiting triage

**Type:** Fix
**Status:** complete
**Branch:** `fix/wait-chip-awaiting-triage`
**Audit:** not needed - one display rule and its tests; no data, permission or contract change.

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

`vetiflow.Server/Models/WaitChip.cs` (`WaitChipRule.For`, 2.11a) shows `new`
only when a case has no acuity, and checks it last. The revised prototype and
the 2026-10-28 decisions make new intakes provisional: they have an acuity
from the intake but wait in stage Incoming ("Awaiting triage") and show
**New**, even when Critical. Today such a case shows `stat` or `minutes`.

Reproduce: `WaitChipRule.For(AcuityLevel.Critical, CaseStatus.Unassigned, CaseStage.Incoming)`
returns `Stat`; it should return `New`.

## The fix

The rule follows the revised decision, first match wins: stage Incoming →
`New`; Critical → `Stat`; ready for next step → `Ready`; stage Recheck →
`Recheck`; otherwise `Minutes`. A case without acuity outside Incoming (only
old data) shows `Minutes`. The JSON values and the board list are unchanged.

## Build steps

- [x] **Step 1 - failing tests** - `WaitChipRuleTests` updated: an Incoming
  case is `new` at every acuity, including Critical and none; an untriaged case
  outside Incoming is `minutes`. *Done when:* they fail against today's rule
  (5 failed).
- [x] **Step 2 - fix** - reorder `WaitChipRule.For`. *Done when:*
  `WaitChipRuleTests` and the `CasesEndpointTests` pass.

## Verify

- `WaitChipRuleTests`; `CasesEndpointTests.GetCases_ClinicianFallsBackToTechnician`
  (an untriaged Incoming case is `new`).

## Result

- **Prepared:** branch `fix/wait-chip-awaiting-triage`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-28 (ran): PASS for Workflow tests, Server build, Server tests, Client lint, Client build and Client tests.
- **Check:** not needed; `WaitChipRuleTests` (13) cover the rule and `CasesEndpointTests` the board list.
- **Audit:** not needed.
- **Follow-ups added to build plan:** none
- **Deploy notes:** none (no migration). Goes live with the next API deploy.

Also changed: `CasesEndpointTests.GetCases_ReturnsCardFields` moves its Critical case to Treatment, so it still checks STAT.
