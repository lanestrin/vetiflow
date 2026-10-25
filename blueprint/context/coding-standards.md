# Coding Standards

> How we write code in VetiFlow. Read the sections that apply before changing
> code. When a convention is decided in review, add it here so the next feature
> follows it.

## Proportional engineering

Build for what the current spec needs, not for hypothetical scale.

- Reuse existing code, the .NET and React standard libraries, and installed
  packages before adding anything.
- Add an abstraction, package, service or config setting only for a current
  requirement. An interface with one implementation needs a reason (a test fake
  is a reason; "we might swap it later" is not).
- Simplicity never removes real security checks: sign-in, role checks, owner
  scope, input validation, no PII in logs.

## C# and ASP.NET Core

- Tabs for indentation, file-scoped namespaces, nullable enabled, implicit usings.
- Constructor injection. Private fields `_camelCase`.
- Descriptive lambda parameter names: `emergencyCase => emergencyCase.Stage`, not `c => c.Stage`.
- Controllers in `vetiflow.Server/Controllers/`, `[ApiController]`, routes under `api/`.
- Request and response types (DTOs) live in `vetiflow.Server/Contracts/<Area>/`.
  Never return EF entities from an endpoint.
- Enums serialise as camelCase strings. Reject numeric and unknown enum values.
- Errors return ProblemDetails. No stack traces or internal details in
  production responses.
- `async` all the way, pass `CancellationToken` through to EF calls.

## EF Core and Postgres

- Read queries use `AsNoTracking()` and project to a DTO with `Select`.
  Watch for N+1: load what a list needs in one query.
- Enums are stored as text (`EnumColumnMigration`). Renaming an enum value needs
  a migration that updates existing rows by name.
- Deletes never cascade (`DeleteBehavior.Restrict`).
- Database rules (unique indexes, partial indexes, FKs, check constraints) live
  in `VetiFlowDbContext.OnModelCreating` and are tested against real Postgres.
- Every model change ships its migration in the same branch. Use `/migration`.
  `dotnet ef migrations has-pending-model-changes` must report none.
- Never edit a migration that is already on `main`. Add a new one.
- Domain rules live on the entity when they can: `EmergencyCase.RecordTriage`
  is the only way to set `Acuity`.

## SignalR

- Hub at `/hubs/cases`. Broadcast IDs and minimal state, never owner details or
  clinical notes (build plan S.7).
- The client refetches what it needs after a hub message.

## React and TypeScript

- Function components and hooks only. One job per component.
- Files: `ComponentName.tsx`, `ComponentName.module.scss` and
  `ComponentName.test.tsx` side by side in `src/components/<area>/`.
- Pages in `src/routes/`, API and hub calls in `src/services/`, shared types in
  `src/types/`.
- Strict TypeScript. No `any`; use `unknown` and narrow.
- API base URL from `import.meta.env.VITE_API_BASE_URL`. Nothing secret in `VITE_` variables.
- Display labels for staff and owners live in the client, separate from the
  API's enum values. Owner-facing text never shows acuity.

## Styling

- SCSS modules per component. Shared values in `src/styles/_tokens.scss`.
- No inline styles. AA contrast. Visible focus states.
- UI that recreates a design is built against a screenshot in
  `blueprint/reference/`, not a description.

## Security

- Every new endpoint and hub method requires a signed-in staff user once staff
  sign-in exists (build plan S.5), and checks the role it needs.
- Owners reach only their own pet's case, through a scoped, expiring link or
  sign-in. Never expose a case or patient by ID alone.
- Never log or return owner contact details, intake notes, tokens or
  connection strings.
- Validate every request: known enum names only, required fields present, text
  within length limits.
- Secrets live in user secrets locally and environment variables on Render and
  Vercel. Never in source, `appsettings*.json` or `.env` files in git.
- A new security risk found while working goes into the build plan as its own
  item, not into the current branch.

## Testing

Tests are a gate, not an extra. Both runners exist, so:

- **A step that adds logic ships a passing test in the same diff.** The step is
  not ticked until the test passes.
- **What to test:** domain methods (`RecordTriage`), validators, endpoint
  behaviour (status codes, contract shape, authorization), database rules,
  migrations, client services and component behaviour (what the user sees and
  can do).
- **What not to unit test:** pure layout and colours. Check those with a
  screenshot through `/check`.
- **An empty run is a failure.** "0 tests ran" never counts as passed.
- **Write the test first when fixing a bug:** a test that fails before the fix
  and passes after.

### Server tests (`vetiflow.Server.Tests`)

- xUnit v3 on Microsoft.Testing.Platform. Run with `dotnet test --project vetiflow.Server.Tests`.
- Folders: `Unit/` (no database), `Api/` (through `VetiFlowApiFactory`),
  `Data/` (constraints, seeder, migrations). Shared helpers in `Infrastructure/`.
- Build test data with `Infrastructure/TestData.cs`. Extend it rather than
  building entities by hand in each test.
- Anything that touches database rules uses the real Postgres fixture. Never EF
  InMemory or SQLite.
- Name tests `Method_Condition_Result` or `Method_Result`
  (`GetCases_ReturnsNewestFirst`). Arrange, act, assert, separated by blank lines.
- Use `TestContext.Current.CancellationToken` for async calls.
- Postgres comes from Testcontainers (Docker running) or `VETIFLOW_TEST_POSTGRES`.

### Client tests (`vetiflow.client`)

- Vitest, React Testing Library, MSW. Run with `npm run test -- --run`.
- Query by role and label (`getByRole('heading', { name: ... })`), not by class
  or test id, so tests also check accessibility.
- API calls go through MSW handlers in `src/test/server.ts`. Unhandled requests
  fail the test. Build data with `src/test/builders.ts`.
- The hub is faked with `src/test/fakeCaseHub.ts`.

### Browser tests

- Not set up yet. `/tests browser` adds Playwright for build plan 7.2. Until
  then, `/check` uses the running app and screenshots.

## Comments

- Comment the why, not the what. Delete comments that restate the code.
- No banner comments or section dividers.
- A comment earns its place for a non-obvious decision, a gotcha, or a link to
  a spec or issue.

## Writing

- No em dashes in docs, comments, commit messages or specs. Use a hyphen, comma,
  colon or parentheses.
- Commit messages: conventional prefixes (`feat:`, `fix:`, `chore:`, `test:`,
  `docs:`), one work item per commit, the body says why.
