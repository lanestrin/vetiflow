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

- **Commit and push only through `/approve`**, which only the person runs. Otherwise leave changes in the working tree. Never merge, force-push or commit to `main`.
- **One work item per branch.** Never build on `main`. Never mix two build-plan items in one branch.
- **Spec before code.** Planned work starts with `/feature`, unplanned work with `/fix`. Wait for the person's OK on the spec; its status then becomes `approved`. The one exception: changes asked for in review of an open PR go on the same branch without a new spec (step 7 of the loop in `blueprint/context/ai-interaction.md`). Repair steps that `/ready` adds for blocking findings from an audit the person asked for fall under the approved spec and need no new OK; any other spec change does.
- **Never run migrations against production.** Apply migrations only with `scripts/db-target.ps1 -Migrate` and start the app (which migrates on startup) only with `scripts/db-target.ps1 -StartApp`. They run the command only for a local database and bind it to the exact connection string they checked. A plain `scripts/db-target.ps1` check authorizes nothing, and never run `dotnet ef database update` or `dotnet run --project vetiflow.Server` directly.
- **Never touch secret values.** Never read, edit, create, print or copy real `.env` files or their variants, and never run commands that list secret values (`dotnet user-secrets list`, `printenv`, `env`, `Get-ChildItem env:`), not even masked. Test protections only with harmless fixtures. `.claude/settings.json` denies these to Claude's tools and a hook blocks the usual spellings of the commands, but neither stops a script that reads files or variables itself, and on native Windows there is no sandbox (see the Safety section of `blueprint/context/ai-interaction.md`).
- **Verify before saying done.** Run `scripts/verify.ps1` and report the real output. Never say a check passed without running it.
- **Acuity changes only through `EmergencyCase.RecordTriage`.** Never assign `Acuity` directly.
- **Owners never see the staff board** and never reach a case or patient by ID alone.
- **No owner contact details, intake notes, connection strings or stack traces** in logs or error responses.

## Read these when relevant

- `blueprint/project-plan.md` - what VetiFlow is for, users, data, stack, constraints. Read before planning.
- `blueprint/build-plan.md` - the ordered list of work items with stable IDs and branch names.
- `blueprint/context/coding-standards.md` - read before changing code or writing tests. "Readable code" is the house style: clear names, one job per unit, no speculative layers.
- `blueprint/context/ai-interaction.md` - read when running a workflow skill.
- `blueprint/context/current-feature.md` - the one spec being built in this checkout.
- `blueprint/context/findings.md` - open audit findings for the current work.
- `blueprint/history/` - finished specs. Read the matching file when work touches an earlier feature.

## Workflow

The loop (full description in `blueprint/context/ai-interaction.md`): `/feature` or `/fix` -> "OK and build" (runs `/ready`: build, repair in-scope failures, Verify, `/check` when needed, readiness report) -> `/complete` -> `/approve` -> the person squash-merges the PR -> `/done` (the person types it: it checks the merge on GitHub, switches to an up-to-date `main`, deletes the local branch and the landing drafts). `/implement` builds step by step instead, if wanted. `/audit` runs only when the person types it; the spec's Audit line only recommends one for application changes and never blocks `/complete`. `/clear` is optional context management, never a required step. `/verify` runs inside `/ready`, `/implement` and `/complete`. When unsure what to type next, `/status`. Every task and command ends with a `Status:` line and one `Next:` action ("Ending a turn" in `ai-interaction.md`).

| Need | Command |
| --- | --- |
| Start the next planned item | `/feature` or `/feature 2.3` |
| Build the approved spec, repair and check until ready for `/complete` | `/ready` (or "OK and build" on the spec) |
| Build it one step at a time | `/implement` |
| Run every automated check | `/verify` |
| Run a few tests quickly | `/test <filter>` |
| Prove it in the running app | `/check`, or `/check guide` for steps to try yourself |
| Review the branch for problems (only when you want one) | `/audit`, or `/audit focused` to re-check repairs |
| Finish and archive the work | `/complete` |
| Commit, push and open the PR | `/approve`, or `/approve "<message>"` |
| After you merge the PR: back to an up-to-date `main` | `/done` |
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

# Migrations (adding one touches no database; applying one goes through db-target)
dotnet tool restore   # installs the dotnet-ef pinned in .config/dotnet-tools.json; Verify does not run it
dotnet ef migrations add <Name> --project vetiflow.Server
dotnet ef migrations has-pending-model-changes --project vetiflow.Server
powershell -ExecutionPolicy Bypass -File scripts/db-target.ps1 -Migrate

# Run the app (db-target checks the database is local, then starts it bound to that string)
powershell -ExecutionPolicy Bypass -File scripts/db-target.ps1 -StartApp
cd vetiflow.client && npm run dev
```

Server tests need Docker running for Testcontainers, or `VETIFLOW_TEST_POSTGRES` pointing at an existing Postgres server.
