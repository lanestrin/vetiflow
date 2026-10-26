# Feature: Secrets handling

**From build-plan:** feature S.10a
**Status:** complete
**Branch:** `chore/secrets-handling`
**Audit:** not needed - a workflow test, the project plan and a GitHub setting; no application code, config or data

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

Keep secrets where they belong (user secrets locally, Render and Vercel
environment variables in hosting) and make a slip fail Verify or GitHub's push
check instead of reaching the repository, with a written way to rotate a
secret when one is exposed.

## In scope

- What is already true, now held by a test:
  - no tracked `appsettings*.json` has a `ConnectionStrings` section or a
    `Password=` value (the server reads its connection string from user
    secrets locally, `UserSecretsId` in `vetiflow.Server.csproj`, and from
    `ConnectionStrings__VetiFlowDatabase` on Render);
  - the client uses only `VITE_API_BASE_URL`, which is public by design;
  - no env file is tracked except an `.env.example` (none exists today).
- A new workflow test, `scripts/tests/secrets-config.tests.ps1`, that checks
  the three rules above on tracked files, with fixture cases that prove each
  check catches a violation. It runs in Verify's "Workflow tests" step, so CI
  runs it too.
- A "Secrets and rotation" part in project plan section 8: every secret by
  name and where it lives, and the rotation steps for the database password.
- Your step: turn on GitHub secret scanning and push protection.

## Out of scope

- The low-privilege app role and the separate migration user (S.10b).
- Scanning git history for past leaks: nothing secret was ever meant to be
  committed, and GitHub's secret scanning scans history once it is on.
- API keys for an AI provider (none yet, 5.1) and auth secrets (S.5): they
  join the list when they exist.
- A fixed rotation schedule: belongs in the operator runbook (8.11).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - secrets config test** - add `scripts/tests/secrets-config.tests.ps1`
  in the style of `ci-workflow.tests.ps1` (plain PowerShell, `Assert-True`,
  a pass/fail summary, exit code). It reads only tracked files
  (`git ls-files`) and never opens an env file: env files are checked by name
  only. Checks:
  1. every tracked `appsettings*.json` parses and has no `ConnectionStrings`
     property and no string value containing `Password=` (any case);
  2. every `VITE_` name in tracked `vetiflow.client` files is in the allowlist
     (`VITE_API_BASE_URL`);
  3. no tracked path is an env file other than `.env.example`.
  Fixture cases: a settings JSON with `ConnectionStrings`, one with a
  `Password=` value, a source line with `VITE_STRIPE_SECRET`, and a tracked
  path `vetiflow.client/.env.local` are each caught; the real repo passes.
  *Done when:* the script prints "all N checks passed" and exits 0, and
  Verify's "Workflow tests" step passes with it.
- [x] **Step 2 - project plan** - in section 8, replace the "Env vars by name"
  bullet with a "Secrets and rotation" bullet: the database connection string
  (user secrets locally, `ConnectionStrings__VetiFlowDatabase` on Render), the
  public `VITE_API_BASE_URL` on Vercel, that `secrets-config.tests.ps1` guards
  both, and the rotation steps (reset the database password in Supabase,
  update Render's value and save so it redeploys, check `GET /api/health` is
  `healthy`, update local user secrets). Rotate when a secret may have been
  exposed or someone with access leaves. *Done when:* the bullet is there,
  names match `Program.cs` and the client, and nothing else in section 8
  changed.
- [x] **Step 3 - your step: GitHub secret scanning** - on GitHub, Settings,
  Advanced Security (or Code security): turn on Secret scanning and Push
  protection. On a private repository without GitHub Secret Protection these
  may not be offered; then say so and it is recorded as not available.
  *Done when:* you confirm they are on, or that they are not offered.

## Files / areas

- `scripts/tests/secrets-config.tests.ps1` (new)
- `blueprint/project-plan.md` (section 8)
- `blueprint/build-plan.md` (S.10 split into S.10a and S.10b, approved
  2026-10-26)
- GitHub repository settings (your step)

## Data / contracts

- None.

## Security

- No new surface.
- The test reads tracked files only, checks env files by path only, and prints
  only rule names and file paths, never a value.
- It runs only on tracked files, so a secret in an untracked local file (user
  secrets, `.env.local`) is not its concern; `.gitignore`, the deny rules and
  the hook cover those.

## Testing

- Workflow: `scripts/tests/secrets-config.tests.ps1`, run by Verify.
- Server and client: none (no code change).
- `/check`: not needed; step 3 is confirmed by you.

## Notes for the AI

- The secret-command hook blocks a command whose text names an env file or a
  connection-string variable. Write the test with the file tools and run it
  only through `scripts/verify.ps1` or by its script path; never put those
  names in a shell command line.
- Fixtures are inline strings in the test, never files on disk.
- Match on JSON property names case-insensitively (`connectionStrings` too).

## Open questions

- None.

## Step 3 record

Confirmed 2026-10-26 from a screenshot of Settings, Advanced Security: Secret
Protection enabled and Push protection on. The same page shows CodeQL default
setup already running (last scan an hour earlier), Dependabot alerts and
security updates on, and Dependabot malware alerts off.

## Result

- **Prepared:** branch `chore/secrets-handling`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T21:32:54Z, chore/secrets-handling @ 57cd66c)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow check:** `secrets-config.tests.ps1` passed all 16 checks in Windows PowerShell 5.1; pwsh was not installed locally, so CI gives its first PowerShell 7 run.
- **Check:** not run - no running-app behaviour; step 3 confirmed by the person's screenshot
- **Audit:** not needed
- **Follow-ups added to build plan:** none new; 8.7 now notes that CodeQL default setup is already on, leaving npm and NuGet in Dependabot
- **Deploy notes:** none
