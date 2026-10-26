# Feature: Input validation and safe error responses

**From build-plan:** feature S.12
**Status:** complete
**Branch:** `feature/input-validation`
**Audit:** recommended - build plan phase S; changes `Program.cs` error handling and request limits for every endpoint

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

Every error the API returns is a ProblemDetails body (`application/problem+json`)
that names what was wrong with the request and never shows exception text,
type names, stack traces or connection details, and request bodies have a size
limit. Every write in M2 builds on this contract [13].

## In scope

- `AddProblemDetails()`, `UseExceptionHandler()` and `UseStatusCodePages()` in
  `Program.cs`, so errors outside controllers (unknown route, unhandled
  exception, a body that is too large) get the same ProblemDetails shape that
  `[ApiController]` already gives model errors and `NotFound()`.
- An unhandled exception returns `500` with a generic title. A rejected request
  body (`BadHttpRequestException`) keeps its own status code (for example `413`)
  instead of becoming `500`.
- A global request body limit of 1 MB in Kestrel (see Decisions).
- Tests that pin the error contract for each current endpoint: unknown case,
  a non-GUID id, malformed JSON, the wrong content type, an unknown route, a
  database failure in Production, and an oversized body.
- `coding-standards.md`: the body limit, and that a new text field gets a
  `[StringLength]` limit in its request DTO.

## Out of scope

- Field length limits on text columns: no request accepts text today. Each
  item that adds a text field (4.1a, 4.6, 4.8 ...) sets its limit.
- Stage transition rules and their `409` (2.1); concurrency `409` (2.2).
- `GET /api/health` keeps its `healthy` / `unhealthy` body: it is a status
  report Render reads by status code, not an error.
- What error logs contain (8.3, log redaction).
- Showing API error details in the client: `casesApi.ts` keeps its generic
  messages until a form needs them (4.1b).
- Rate limiting (S.9).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - error contract tests** - move `StartupTests.CreateHost` into
  `Infrastructure/TestHosts.cs` so other test classes can start a host with
  its own settings, and add `Api/ErrorResponseTests.cs` with a shared
  `AssertProblemAsync(response, status)` check (status code,
  `application/problem+json`, `status` and `title` present). *Done when:*
  the tests for controller errors (`UpdateStage_UnknownCase_ReturnsNotFoundProblem`,
  `UpdateStage_MalformedJson_ReturnsValidationProblem`,
  `UpdateStage_WrongContentType_ReturnsUnsupportedMediaTypeProblem`) pass, and
  `UnknownRoute_ReturnsNotFoundProblem`, `UpdateStage_NonGuidId_ReturnsNotFoundProblem`
  and `GetCases_DatabaseUnreachable_ReturnsProblemWithoutInternals` fail
  because those responses have no ProblemDetails body yet. `StartupTests`
  still pass.
- [x] **Step 2 - ProblemDetails everywhere** - `AddProblemDetails()`,
  `UseExceptionHandler()` right after `UseForwardedHeaders()` (with a status
  code selector that keeps a `BadHttpRequestException`'s own status), and
  `UseStatusCodePages()`. *Done when:* every test in `ErrorResponseTests`
  passes, the `500` body contains none of `Exception`, `Npgsql`, `127.0.0.1`
  or `   at `, and `CasesEndpointTests`, `CorsTests` and `HealthEndpointTests`
  still pass.
- [x] **Step 3 - request body limit** - set Kestrel's `MaxRequestBodySize`
  for the API. In-process tests use TestServer, which does not apply Kestrel
  limits, so the test runs against the real image. *Done when:*
  `ServerImageTests.ServerImage_OversizedBody_ReturnsPayloadTooLargeProblem`
  sends a stage update one byte over the limit and gets `413` as
  ProblemDetails, and a normal stage update to the same container is not
  rejected with `413`.
- [x] **Step 4 - standards** - add to `coding-standards.md` (C# and ASP.NET
  Core): bodies over the limit return `413`; every text field in a request
  DTO has a `[StringLength]` limit. *Done when:* both lines are there and
  match the code.

## Files / areas

- `vetiflow.Server/Program.cs`
- `vetiflow.Server.Tests/Api/ErrorResponseTests.cs` (new)
- `vetiflow.Server.Tests/Infrastructure/TestHosts.cs` (new, from `StartupTests`)
- `vetiflow.Server.Tests/Api/StartupTests.cs` (uses `TestHosts`)
- `vetiflow.Server.Tests/Deployment/ServerImageTests.cs`
- `blueprint/context/coding-standards.md`

## Data / contracts

- No entities, columns or migrations.
- Every `4xx` and `5xx` from `/api/*` is `application/problem+json` with
  `type`, `title`, `status` and `traceId`. Model errors keep their `errors`
  map keyed by field name (the client and later forms rely on it).
- Unhandled exception: `500`, title "An error occurred while processing your
  request." (framework default), no `detail`.
- Body over the limit: `413` ProblemDetails.
- Exception: `GET /api/health` keeps `{ status, database }` on `200` and `503`.
- Hub messages: none.

## Security

- No new endpoint or hub method.
- Responses never contain exception messages, type or namespace names, stack
  traces, SQL, hostnames or connection string parts. The Production test
  checks this with a real database failure.
- Development keeps the developer exception page (the framework adds it only
  in Development); Testing and Production never show it.
- SignalR keeps detailed hub errors off (the default).

## Testing

- Server, in process (`ErrorResponseTests`, real Postgres through
  `VetiFlowApiFactory`): `UnknownRoute_ReturnsNotFoundProblem`,
  `UpdateStage_UnknownCase_ReturnsNotFoundProblem`,
  `UpdateStage_NonGuidId_ReturnsNotFoundProblem`,
  `UpdateStage_MalformedJson_ReturnsValidationProblem`,
  `UpdateStage_WrongContentType_ReturnsUnsupportedMediaTypeProblem`.
- Server, Production host with an unreachable database (`TestHosts`, no
  Postgres needed): `GetCases_DatabaseUnreachable_ReturnsProblemWithoutInternals`.
- Server, real image (Docker): `ServerImage_OversizedBody_ReturnsPayloadTooLargeProblem`.
- Client: none (no client change).
- `/check`: not needed. Every behaviour is an HTTP response the tests assert,
  and the real image test covers Kestrel.

## Notes for the AI

- `[ApiController]` already maps `NotFound()` and `415` to ProblemDetails and
  model errors to `ValidationProblemDetails`. Keep that. The new middleware
  covers what never reaches a controller.
- `AllowInputFormatterExceptionMessages = false` stays: it keeps parser
  messages (type names) out of `400` bodies.
- `UseStatusCodePages` writes a body only when the response has none, so it
  must not change CORS preflights or hub negotiation. `CorsTests` and
  `CasesEndpointTests.UpdateStage_NotifiesConnectedBoards` prove it.
- The exception handler still logs the exception, as `HealthController`
  already does. What logs may contain is 8.3.

## Decisions

- **Request body limit: 1 MB** (1,048,576 bytes), chosen 2026-10-26. It covers
  any planned JSON form (intake notes, handoffs) with room; no file upload is
  planned. Kestrel's default was about 30 MB.

## Result

- **Prepared:** branch `feature/input-validation`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T20:38:10Z, feature/input-validation @ bc94f8f)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1 showed the three new-contract tests failing as expected (unknown route and non-GUID id had no body; the Production 500 escaped as `NpgsqlException`); after step 2, 39/39 in-process tests passed; step 3, 3/3 `ServerImageTests` passed.
- **Check:** not run - every behaviour is an HTTP response the tests assert; the image test covers Kestrel
- **Audit:** recommended, not run (phase S; error handling and request limits for every endpoint)
- **Follow-ups added to build plan:** none
- **Deploy notes:** none (no settings or migrations; bodies over 1 MB now get `413`)
