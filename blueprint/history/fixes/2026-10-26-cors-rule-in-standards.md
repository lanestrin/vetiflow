# Fix: CORS rule in coding standards

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/cors-rule-in-standards`
- **Audit:** not needed - docs only; one line in `coding-standards.md`, no application code or config

## The problem

S.3 made allowed browser origins come from `Cors:AllowedOrigins`, with startup
refusing an empty list, `*` and anything but a bare `https://host[:port]`
origin (`vetiflow.Server/Hosting/CorsOrigins.cs`). `blueprint/project-plan.md`
section 8 (lines 107-112) records this, but the Security section of
`blueprint/context/coding-standards.md` (line 95 on) does not. That is the file
read before changing code, so a later change could add an origin in code, use
`AllowAnyOrigin()` or build a second CORS policy without any standard saying
not to.

## The fix

Add one bullet to the Security section of `coding-standards.md`, after the
secrets bullet:

> - Browser origins come only from `Cors:AllowedOrigins`, as bare
>   `https://host[:port]` origins. Never `*`, `AllowAnyOrigin()` or an origin
>   in code; add a new one to configuration (project plan section 8).

It must not change any other rule or any code, config or test.

## Build steps

- [x] **Step 1 - add the rule.** Add the bullet above to the Security section
  of `blueprint/context/coding-standards.md`.
  *Done when:* the bullet is in the Security section, matches the behaviour of
  `CorsOrigins.cs` and project plan section 8, and nothing else in the file
  changed.

## Verify

- No logic changes, so no new test. `scripts/verify.ps1` passes (it includes
  the workflow tests).
- Nothing to observe in the app; `/check` is skipped.

## Result

- **Prepared:** branch `fix/cors-rule-in-standards`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T19:36:20Z, fix/cors-rule-in-standards @ 0d77d83)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check:** not run - docs only, nothing to observe in the app
- **Audit:** not needed
- **Follow-ups added to build plan:** none
- **Deploy notes:** none
