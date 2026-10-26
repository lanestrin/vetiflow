# Feature: Hosting hardening

**From build-plan:** feature S.3
**Status:** complete
**Branch:** `fix/hosting-config`
**Audit:** recommended - Phase S security work that changes application config (`Program.cs`, `appsettings*.json`, the server `Dockerfile`).

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

The API behaves correctly and safely behind Render's proxy. Allowed browser
origins come from configuration instead of code, the app sees the real scheme
and client address, browsers are told to use HTTPS only, the database
connection works over Render's IPv4 network, and the container no longer runs
as root. S.4 is merged in here.

## In scope

- **CORS from configuration:** `Cors:AllowedOrigins` (a string array) replaces
  the two origins hard-coded in `Program.cs`. `appsettings.json` holds the
  production origin `https://vetiflow.vercel.app`, and
  `appsettings.Development.json` holds `https://localhost:52540` (the Vite dev
  server). Render can override it with `Cors__AllowedOrigins__0`. Startup
  fails with a message naming the setting when the list is empty, or when an
  entry is `*` or anything other than a bare `https://host[:port]` origin.
- **Forwarded headers:** `X-Forwarded-For` and `X-Forwarded-Proto`, taken from
  the nearest proxy only (`ForwardLimit = 1`). The known-proxy lists are
  cleared, because Render publishes no fixed proxy addresses and the container
  is only reachable through Render. `UseForwardedHeaders` runs first in the
  pipeline.
- **HSTS** outside Development (`UseHsts`, the ASP.NET Core defaults), after
  forwarded headers so it applies to requests that reached Render over HTTPS.
- **Supabase session pooler:** documentation only. Render has no IPv6, and
  Supabase's direct host is IPv6-only, so production must use the session
  pooler connection string (port 5432, IPv4). No code reads it differently.
- **Non-root container (from S.4):** the runtime stage of
  `vetiflow.Server/Dockerfile` runs as the image's built-in non-root user
  (`USER $APP_UID`).

## Out of scope

- Sign-in, roles and hub authorization (S.5-S.7), and rate limiting (S.9), which
  will rely on the client address set here.
- Separate database users for the app and for migrations (S.10).
- HSTS preload, or a max-age other than the framework default.
- Changing Render, Vercel or Supabase settings. Those are your steps, listed in
  Deploy notes.

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - CORS from configuration** - read `Cors:AllowedOrigins` and
  validate it at startup, then build the existing `VetiFlowClient` policy
  from it with the same methods, headers and credentials as today. Add the
  origins to `appsettings.json` and `appsettings.Development.json`. *Done
  when:* new `CorsTests` pass:
  `Preflight_FromConfiguredOrigin_IsAllowed`,
  `Preflight_FromOtherOrigin_IsNotAllowed`,
  `Preflight_WithOverriddenOrigins_AllowsOnlyThose` and
  `Startup_WithInvalidOrigins_FailsNamingTheSetting` (theory: empty list, `*`,
  `http://` origin, origin with a path).
  *As built:* the validation rules are tested directly as
  `Read_WithInvalidOrigin_FailsNamingTheSetting` (`*`, `http://`, trailing
  slash, path, user info, no scheme, empty), `Read_WithNoOrigins_...` and
  `Read_WithValidOrigins_ReturnsThem`. `Startup_WithInvalidOrigins_...`
  proves `Program.cs` applies them. The rules live in
  `vetiflow.Server/Hosting/CorsOrigins.cs`.
- [x] **Step 2 - Forwarded headers and HSTS** - configure
  `ForwardedHeadersOptions`, call `app.UseForwardedHeaders()` first, and
  `app.UseHsts()` when not in Development. *Done when:* new `ProxyHeadersTests`
  pass, all with a non-localhost `Host` (HSTS skips localhost):
  `Request_ForwardedAsHttps_GetsHsts`,
  `Request_NotForwarded_GetsNoHsts`, and
  `Request_WithForwardedFor_SeesNearestProxyAddressOnly`, which reads the
  address through a test-only endpoint added in the test host, not in the app.
- [x] **Step 3 - Non-root container** - add `USER $APP_UID` to the runtime
  stage. *Done when:* `ServerImageTests` gains
  `ServerImage_RunsAsNonRootUser` (the container's `id -u` is not `0`) and the
  existing health test still passes.
- [x] **Step 4 - Docs** - project-plan section 8: CORS origins by setting name
  and their defaults (replacing "Planned by build plan S.3"), the proxy and HSTS
  behaviour, the session pooler requirement with where to copy the string in
  Supabase (Connect, Session pooler), and that the API runs as non-root.
  *Done when:* the text is there and a full Verify passes.

## Files / areas

- `vetiflow.Server/Program.cs`
- `vetiflow.Server/appsettings.json`, `vetiflow.Server/appsettings.Development.json`
- `vetiflow.Server/Dockerfile`
- `vetiflow.Server.Tests/Api/CorsTests.cs`, `vetiflow.Server.Tests/Api/ProxyHeadersTests.cs` (new)
- `vetiflow.Server.Tests/Deployment/ServerImageTests.cs`
- `blueprint/project-plan.md` (section 8)

## Data / contracts

- No entities or migrations.
- New setting `Cors:AllowedOrigins` (string array, env var
  `Cors__AllowedOrigins__0`, `__1`, ...). Each entry is an absolute `https`
  origin with no path. Startup refuses anything else, and an empty list.
- Responses outside Development carry `Strict-Transport-Security` on HTTPS
  requests (ASP.NET Core default max-age, 30 days).
- The API sees the client address and scheme from Render's forwarded headers.
  S.9 depends on that.

## Security

- No new endpoint. The test-only endpoint lives in the test host and never in
  the app.
- CORS fails closed. A missing or malformed origin list stops startup instead
  of allowing everything, and `*` is never accepted (it cannot be combined with
  credentials anyway).
- Only the nearest proxy's forwarded values count, so a client cannot spoof its
  address by sending its own `X-Forwarded-For`.
- The container runs without root, which limits what a code-execution bug
  could do inside it.
- The startup error names the setting, never its value. No connection strings
  in logs or errors, as before.

## Testing

- Server (in-process, real Postgres through the shared factory): `CorsTests`,
  `ProxyHeadersTests` as named above. The startup-failure theory needs no
  database.
- Server (Docker): `ServerImageTests.ServerImage_RunsAsNonRootUser`.
- Client: unchanged.
- `/check`: run the app with `scripts/db-target.ps1 -StartApp` and the client
  with `npm run dev`. The board loads through the Vite proxy, and a request
  from `https://localhost:52540` is not blocked by CORS.

## Notes for the AI

- Keep the policy name `VetiFlowClient` and its `AllowAnyHeader`,
  `AllowAnyMethod` and `AllowCredentials` as they are. SignalR needs
  credentials.
- Configuration arrays merge by index, so Development's entry 0 replaces the
  production entry 0. That is intended: local runs allow only the Vite origin.
- .NET 10 names the known-network list `KnownIPNetworks` (`KnownNetworks` is
  obsolete). Clear both it and `KnownProxies`.
- `$APP_UID` is defined in the official .NET runtime images. Port 10000 needs no
  root.
- Production keeps today's origin through `appsettings.json`, so this deploy
  needs no new Render variable. That is deliberate: nothing breaks on merge.
- Deploy notes for `/complete`: confirm that Render's
  `ConnectionStrings__VetiFlowDatabase` is Supabase's session pooler string.
  After the deploy, `/api/health` should answer `healthy` and the board on
  Vercel should load. Nothing else to set.

## Result

- **Prepared:** branch `fix/hosting-config`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T19:18:13Z UTC, `fix/hosting-config` @ be81ee3; that run was a fresh full run in Windows PowerShell 5.1)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests (78 of 78)
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** PASS in the running app (`scripts/db-target.ps1 -StartApp`, target `local`, and `npm run dev`). `/api/health` returned `healthy`/`connected`. The preflight from `https://localhost:52540` was allowed, with credentials. Preflights from `https://attacker.example` and `https://vetiflow.vercel.app` (not allowed in Development) got no allow-origin header. The board's `/api/cases` loaded through the Vite proxy. No HSTS header in Development.
- **Audit:** recommended, not run (Phase S security work in `Program.cs`, appsettings and the Dockerfile).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** no new Render variable; production keeps `https://vetiflow.vercel.app` through `appsettings.json`. Confirm that Render's database connection string is Supabase's session pooler string. After the deploy, `/api/health` should answer `healthy` and the Vercel board should load. The container now runs as the non-root `app` user.
