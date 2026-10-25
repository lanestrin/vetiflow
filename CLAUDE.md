# VetiFlow

VetiFlow is a real-time ER board for a veterinary emergency clinic. Staff see every active case by stage, acuity and wait time, and changes appear on every open board through SignalR. Pet owners get a separate private page for their own pet only.

## Layout

- `vetiflow.Server/`: ASP.NET Core (.NET 10) API, EF Core with Npgsql (Postgres), SignalR hub at `/hubs/cases`.
- `vetiflow.Server.Tests/`: xUnit v3 on Microsoft.Testing.Platform. Database and API tests run against real Postgres (Testcontainers).
- `vetiflow.client/`: React 19 + Vite + TypeScript + SCSS modules. Vitest, React Testing Library and MSW for tests.
- `blueprint/`: the workflow files. Plans, the active spec, findings and history. See below.
- `scripts/verify.ps1`: the one Verify command.

## Hard rules

These always apply, with or without a skill.

- **Never commit, push, merge or open a PR.** Leave changes in the working tree. The person reviews and commits.
- **One work item per branch.** Never build on `main`. Never mix two build-plan items in one branch.
- **Spec before code.** Planned work starts with `/feature`, unplanned work with `/fix`. Wait for the person's OK on the spec.
- **Never run migrations against production.** Only run `dotnet ef database update`, or start the app with migrations on, against a local or test database. Check the connection string first.
- **Verify before saying done.** Run `scripts/verify.ps1` and report the real output. Never say a check passed without running it.
- **Acuity changes only through `EmergencyCase.RecordTriage`.** Never assign `Acuity` directly.
- **Owners never see the staff board** and never reach a case or patient by ID alone.
- **No owner contact details, intake notes, connection strings or stack traces** in logs or error responses.

## Read these when relevant

- `blueprint/project-plan.md` - what VetiFlow is for, users, data, stack, constraints. Read before planning.
- `blueprint/build-plan.md` - the ordered list of work items with stable IDs and branch names.
- `blueprint/context/coding-standards.md` - read before changing code or writing tests.
- `blueprint/context/ai-interaction.md` - read when running a workflow skill.
- `blueprint/context/current-feature.md` - the one spec being built in this checkout.
- `blueprint/context/findings.md` - open audit findings for the current work.
- `blueprint/history/` - finished specs. Read the matching file when work touches an earlier feature.

## Workflow

The feature loop: `/feature` -> `/implement` -> `/verify` -> `/check` -> `/audit` (risky work) -> `/complete`.

| Need | Command |
| --- | --- |
| Start the next planned item | `/feature` or `/feature 2.3` |
| Build the approved spec | `/implement` |
| Run every automated check | `/verify` |
| Run a few tests quickly | `/test <filter>` |
| Prove it in the running app | `/check`, or `/check guide` for steps to try yourself |
| Review the branch for problems | `/audit` |
| Finish and archive the work | `/complete` |
| A bug or small unplanned change | `/fix "<what is wrong>"` |
| Cause of a failure is unclear | `/debug` |
| Add tests to existing code | `/add-tests <class, method or endpoint>` |
| Set up a test kind | `/tests server`, `/tests client`, `/tests browser` |
| Change the data model | `/migration <Name>` |
| Where did we leave off? | `/status` |
| Explain a plan item first | `/brief <id>` |

## Commands

```bash
# Verify everything (from the repo root)
pwsh -File scripts/verify.ps1
# Windows PowerShell 5.1 instead of pwsh:
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1

# Server
dotnet build vetiflow.Server.Tests/vetiflow.Server.Tests.csproj
dotnet test --project vetiflow.Server.Tests
dotnet test --project vetiflow.Server.Tests --filter-class "*EmergencyCaseTests"

# Client (from vetiflow.client)
npm run lint
npm run build
npm run test -- --run
npm run test -- --run AcuityBadge

# Migrations (local database only)
dotnet ef migrations add <Name> --project vetiflow.Server
dotnet ef migrations has-pending-model-changes --project vetiflow.Server

# Run the app
dotnet run --project vetiflow.Server --launch-profile https
cd vetiflow.client && npm run dev
```

Server tests need Docker running for Testcontainers, or `VETIFLOW_TEST_POSTGRES` pointing at an existing Postgres server.
