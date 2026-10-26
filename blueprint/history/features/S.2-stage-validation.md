# Feature: Reject numeric, unknown and missing stage values

**From build-plan:** feature S.2
**Status:** complete
**Branch:** `fix/stage-validation`
**Audit:** recommended - changes input validation on the one write endpoint (application code, security foundations).

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

`PATCH /api/cases/{id}/stage` must accept only a known stage name. Today it
also accepts numbers (`"stage": 2` moves the case to Treatment), and a body with
no `stage` silently moves the case back to Incoming. Turn off integer enum
parsing for every JSON request, so no enum anywhere in the API can be set by
number [10].

## In scope

- The global `JsonStringEnumConverter` in `Program.cs` stops accepting
  integers (`allowIntegerValues: false`). It covers every enum in every JSON
  request and response; responses already write names.
- `UpdateCaseStageRequest.Stage` becomes a `required` member, so a body without
  `stage` is a 400 instead of defaulting to `Incoming`.
- Invalid JSON input errors no longer echo the parser's message, which names
  internal types (`vetiflow.Server.Models.CaseStage`):
  `JsonOptions.AllowInputFormatterExceptionMessages = false`. The 400 is still
  the framework's validation ProblemDetails with a `stage` error entry.

## Out of scope

- Allowed stage transitions, the `StageChanged` event and custom ProblemDetails:
  2.1.
- Length and format limits on other requests: S.12 (there are no other write
  endpoints yet).
- Enums bound from route or query strings: none exist today. The first endpoint
  that adds one handles it (S.12).
- Case-insensitive names (`"Treatment"`) stay accepted, as today; the client
  sends camelCase.

## Build steps

- [x] **Step 1 - failing tests.** In `CasesEndpointTests`, a theory
  `UpdateStage_InvalidStage_ReturnsBadRequestAndLeavesCaseAlone` with these
  bodies: `{"stage":2}`, `{"stage":"2"}`, `{"stage":99}`,
  `{"stage":"triage,treatment"}`, `{}` and `{"stage":null}`. Each returns 400
  and the case stays `Incoming`. A second test,
  `UpdateStage_InvalidStage_DoesNotExposeTypeNames`, checks the 400 body does
  not contain `vetiflow.Server`. Fold the existing
  `UpdateStage_UnknownStage_ReturnsBadRequestAndLeavesCaseAlone` (`"surgery"`)
  into the theory.
  *Done when:* `/test CasesEndpointTests` shows the new cases failing for the
  numeric, missing and type-name checks (the cases already rejected today may
  pass).
- [x] **Step 2 - fix.** `required` on `UpdateCaseStageRequest.Stage`,
  `AllowInputFormatterExceptionMessages = false`, and enums by name only.
  `allowIntegerValues: false` turned out not to be enough: the built-in
  converter still reads `"triage,treatment"` as Triage | Treatment = 3 =
  Diagnostics. By the person's decision (2026-10-26), a small
  `NameOnlyEnumConverter` (in `vetiflow.Server/Json/`) replaces the built-in
  one for every enum: exactly one defined camelCase name, matched
  case-insensitively as before; numbers, numeric strings, comma lists and
  unknown names are a `JsonException` (400). Unit tests:
  `Unit/NameOnlyEnumConverterTests`.
  *Done when:* `NameOnlyEnumConverterTests` and `CasesEndpointTests` pass, and
  the whole server suite passes (the JSON options are shared by every
  endpoint).
- [x] **Step 3 - Verify.** Full `scripts/verify.ps1`.
  *Done when:* it passes.

## Files / areas

- `vetiflow.Server/Program.cs` (JSON options)
- `vetiflow.Server/Json/NameOnlyEnumConverter.cs` (new)
- `vetiflow.Server/Contracts/Cases/UpdateCaseStageRequest.cs`
- `vetiflow.Server.Tests/Api/CasesEndpointTests.cs`,
  `vetiflow.Server.Tests/Unit/NameOnlyEnumConverterTests.cs` (new)

## Data / contracts

- Request: `PATCH /api/cases/{id}/stage` with `{"stage": "<camelCase name>"}`.
  204 on success, 404 for an unknown case, 400 for a missing, null, numeric,
  numeric-string, combined or unknown stage. Unchanged for the client.
- Every enum in a JSON request is now accepted by name only. Later endpoints
  keep this.
- No model, migration or hub change.

## Security

- No new surface. The endpoint stays open until S.5 adds sign-in.
- 400 responses no longer name internal types.
- A rejected request changes nothing and sends no hub message.

## Testing

- Server (real Postgres, through the API):
  `CasesEndpointTests.UpdateStage_InvalidStage_ReturnsBadRequestAndLeavesCaseAlone`
  (theory, seven bodies including `"surgery"`),
  `UpdateStage_InvalidStage_DoesNotExposeTypeNames`. Existing
  `UpdateStage_MovesCaseAndTouchesLastUpdated`, `_UnknownCase_ReturnsNotFound`
  and `_NotifiesConnectedBoards` still pass.
- Client: none (it already sends names).
- `/check`: not needed; the board's drag and drop sends names, which still
  work, and the tests cover the API.

## Notes for the AI

- One converter for the whole API: change the existing one, do not add a
  per-property converter or a custom validator.
- If `.NET` still accepts the numeric string `"2"` with
  `allowIntegerValues: false`, stop and report it: the fix needs a decision,
  not a custom converter added without one.

## Result

- **Prepared:** branch `fix/stage-validation`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T15:00:47Z UTC, `fix/stage-validation` @ 90972dc; that run was a fresh full run in Windows PowerShell 5.1)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests (51 of 51)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** not run (no running-app behaviour changes; the client already sends names). Before the fix, five of the seven invalid bodies were accepted (`2`, `"2"`, `99`, `"triage,treatment"`, `{}`) and the 400 body named internal types; all now return 400 and leave the case unchanged.
- **Audit:** recommended, not run (input validation; replaces the JSON enum converter for the whole API).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none. API callers that sent enum numbers or comma lists now get 400; the client sends names.
