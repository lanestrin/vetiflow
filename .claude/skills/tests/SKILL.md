---
name: tests
description: Set up or extend a kind of testing in VetiFlow - /tests server (xUnit and Testcontainers), /tests client (Vitest, React Testing Library, MSW), or /tests browser (Playwright end-to-end) - with one real example test and the command wired into verify.ps1. Use for /tests, never mid-feature.
disable-model-invocation: true
---

# tests - set up a kind of testing

A setup task on its own `chore/` or `test/` branch, never slipped into a
feature. It proves the path works with one small real test; feature work adds
the rest.

## Select the mode

- `/tests server`: xUnit v3 project with the Postgres fixture.
- `/tests client`: Vitest, React Testing Library and MSW.
- `/tests browser`: Playwright end-to-end (build plan 7.2).
- No mode: report what exists and ask which to set up.

## 1. Inspect

Read what is already there before adding anything:

- `vetiflow.Server.Tests/` and its `.csproj`, `global.json`
- `vetiflow.client/package.json`, `vite.config.ts`, `src/test/`
- `scripts/verify.ps1`, `.github/workflows/ci.yml`
- the Testing section of `blueprint/context/coding-standards.md`

**Server and client testing already exist** (build plan 1.2). For those modes,
report what is set up and offer only the missing piece the person asks for (for
example a new fixture or test data builder). Do not rebuild them.

## 2. Browser mode

1. Add Playwright as a client dev dependency (`npm install -D @playwright/test`)
   and `npx playwright install chromium`. Ask before installing.
2. Add `vetiflow.client/playwright.config.ts`: base URL of the Vite dev server,
   `webServer` entries that start the API (`dotnet run --project ../vetiflow.Server`)
   and Vite, Chromium only, traces on first retry.
3. Put tests in `vetiflow.client/e2e/`. Exclude that folder from Vitest.
4. Add one smoke test: the board loads and shows at least one lane heading.
5. Add the script `"test:e2e": "playwright test"`.
6. Document the command in `CLAUDE.md` Commands as `Browser tests`. Do **not**
   add it to `verify.ps1` or CI unless the person asks; it needs a database and
   is slower.
7. Ignore `playwright-report/` and `test-results/` in `.gitignore`.

## 3. Verify

Run the new test command and then `/verify`. An empty run is a failure. Report:
runner and versions, files added, commands added, results.

Do not commit. Do not start feature work.
