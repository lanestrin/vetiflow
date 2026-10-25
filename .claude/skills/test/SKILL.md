---
name: test
description: Run a focused subset of server or client tests while working, for example one test class, method or component file. Use for /test, or to check one step quickly before the full /verify.
---

# test - run a few tests quickly

Faster than `/verify`. Use it while building a step. It never replaces Verify.

## Pick the runner from the filter

- A C# class, method or namespace (for example `EmergencyCaseTests`,
  `RecordTriage`, `Api`): server.
- A file or component name under `vetiflow.client` (for example `AcuityBadge`,
  `casesApi`): client.
- No filter: run the tests for the files changed on this branch
  (`git diff --name-only main...`).

## Server (xUnit v3 on Microsoft.Testing.Platform)

```bash
dotnet test --project vetiflow.Server.Tests --filter-class "*EmergencyCaseTests"
dotnet test --project vetiflow.Server.Tests --filter-method "*RecordTriage*"
dotnet test --project vetiflow.Server.Tests --filter-namespace "*Tests.Api"
```

`Data/` and `Api/` tests need Docker running (or `VETIFLOW_TEST_POSTGRES`).

## Client (Vitest)

From `vetiflow.client`:

```bash
npm run test -- --run AcuityBadge
npm run test -- --run src/services
```

Always pass `--run`; without it Vitest stays in watch mode.

## Report

- The exact command, how many tests ran, passed and failed.
- For each failure: test name, the assertion message, and the file and line.
- **0 tests ran is a failure.** Say the filter matched nothing and fix the filter.
