# Coding Standards

> How we write code in VetiFlow. Read the sections that apply before changing
> code. When a convention is decided in review, add it here so the next feature
> follows it.

## Readable code

Correctness and security first, then code a junior developer can follow. Build
for what the current spec needs, not for hypothetical scale.

- Name things after the domain (`EmergencyCase`, `RecordTriage`, `waitMinutes`)
  and follow the framework's usual conventions.
- Give each function, class and component one coherent job. Keep related logic
  together. Extract a helper when it names an intent, isolates a separate
  responsibility or removes real duplication.
- Prefer plain `if`s and loops to clever expressions or long chained calls.
- Make side effects (saving, sending, broadcasting) and business rules easy to
  spot: on the entity, in a named method, not buried inside a mapping.
- Tests read as a story: clear setup, one action, the expected outcome.

Avoid overengineering:

- No length limits for functions, and no swarm of tiny one-line methods.
- Reuse existing code, the .NET and React standard libraries, and installed
  packages before adding anything.
- Add an interface, layer, factory, generic utility, package, service, config
  setting or design pattern only for a current, concrete need. An interface
  with one implementation needs a reason (a test fake is a reason; "we might
  swap it later" is not). Use SOLID to solve a real design problem, not as a
  checklist.
- Code that looks similar is not automatically one abstraction. Wait until the
  cases really share a rule.
- Do not refactor unrelated code for style. Note it as a build-plan idea.
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

## Frontend accessibility

- Target WCAG 2.2 level AA for new or changed UI. Use semantic HTML first:
  buttons for actions, links for navigation, labelled inputs and logical headings.
- Every action works with a keyboard, including an alternative to drag and drop.
  Keep focus visible and predictable; dialogs manage and restore focus.
- Give controls accessible names. Associate instructions and validation errors
  with their fields. Give meaningful images useful alt text and decorative
  images empty alt text.
- Never communicate acuity, status or errors through colour alone. Support
  sufficient contrast, text zoom, narrow screens and reduced-motion preferences.
- Announce important asynchronous changes with appropriate live regions,
  without moving focus or repeatedly announcing the entire board.
- When UI behaviour changes, use existing tests for accessible names, keyboard
  interactions and errors where applicable. Use the existing `/check` for visual
  and focus behaviour; record anything not checked. Automated checks alone do
  not establish accessibility compliance. Do not add another review stage.

Reference: [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/).

## SEO and private pages

- Public pages intended for search need descriptive titles and descriptions,
  logical headings, meaningful links and appropriate canonical URLs. Add sitemap
  entries or structured data only for actual public content that needs them.
- Staff boards, case details and private owner pages are not search content.
  Protect them with server-side access checks, exclude them from public sitemaps,
  and use `noindex` metadata or response headers as appropriate. Neither
  `noindex` nor `robots.txt` provides access control.
- Never put owner or patient details, clinical notes or access tokens in page
  titles, descriptions, social previews, structured data or sitemaps. Private
  pages use generic titles and previews.
- Use the existing frontend stack. Do not add an SEO package, rendering framework
  or metadata layer without a current public-page requirement.

Reference: [Google Search content controls](https://developers.google.com/search/docs/crawling-indexing/control-what-you-share).

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

### Browser and frontend security

- Browser code and hidden UI controls are not authorization boundaries. The API
  validates each request, role and resource scope; send only the data that user
  is authorized to receive.
- Treat user content, API responses and AI output as untrusted. Render text
  through React's normal escaping. Do not use `dangerouslySetInnerHTML`, raw DOM
  HTML insertion, `eval` or executable generated code. If rich HTML is required,
  agree on a sanitization approach before introducing it.
- Validate untrusted link destinations and allow only the protocols the feature
  needs. Never execute AI-generated links, commands or instructions automatically.
- Do not store credentials, session tokens or owner/clinical records in
  `localStorage`, `sessionStorage`, IndexedDB or offline caches. Clear in-memory
  private state on logout or user changes. Keep sensitive data out of browser
  logs, analytics and third-party error reports.
- Use the approved authentication design. Cookie authentication needs secure,
  HttpOnly cookies with appropriate SameSite settings and CSRF protection for
  state-changing requests. Do not invent client-only authentication.
- Minimize third-party scripts and dependencies, especially on private pages.
  Use HTTPS and appropriate CSP, framing, referrer and cache-control headers;
  configure them at the server or hosting layer for the relevant routes.
- Test relevant denied-access, invalid-input and untrusted-content cases when
  implementing a feature. Follow the existing audit-on-request policy.

Reference: [OWASP DOM XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html).

### AI and sensitive data

- Use synthetic records in coding-assistant prompts, fixtures and screenshots.
  Do not send real owner or clinical records to coding assistants or external
  tools without explicit authorization. Existing secret-access restrictions
  always apply.
- Application AI calls go through an approved server-side integration. Send only
  the data the task needs, strip owner contact details and secrets, and do not
  log prompts or responses containing private data by default.
- Treat intake notes, retrieved documents and AI output as data, not trusted
  instructions. They cannot grant access, override validation, trigger tool
  actions or weaken secret protections.
- Validate AI output before using it and preserve the clinician-confirmation
  requirement for clinical suggestions. Never let model output authorize access
  to another owner's case.

Reference: [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

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

- Comment the why, not the what: a non-obvious decision or constraint. Delete
  comments that restate the code.
- No banner comments or section dividers.
- A comment earns its place for a non-obvious decision, a gotcha, or a link to
  a spec or issue.

## Writing

- No em dashes in docs, comments, commit messages or specs. Use a hyphen, comma,
  colon or parentheses.

## Commit messages and PRs

This is the one place these rules live. `/complete` drafts both from them, and
`.github/pull_request_template.md` has the same PR sections.

### Type

Take the conventional type from the branch prefix:

| Branch | Type |
| --- | --- |
| `feature/` | `feat` |
| `fix/` | `fix` |
| `chore/` | `chore` |
| `docs/` | `docs` |
| `test/` | `test` |

A change that breaks an API contract or needs a deploy step (a migration to run,
a new required setting) adds `!` after the type, `feat!: ...`, and a
`BREAKING CHANGE: <what to do>` footer.

### Commit message

- Subject: `<type>: <summary>`, imperative ("add", not "added"), at most 72
  characters, no full stop. For a build-plan item, end with its ID:
  `feat: add owners and repeated vitals (0.2)`.
- Blank line, then a short paragraph saying why the change was needed.
- Then 3 to 6 bullets saying what changed.
- Trailers last, one per line:
  - `Refs: build-plan <id>` for a feature, or
    `Refs: blueprint/history/fixes/<file>` for a fix.
  - `BREAKING CHANGE: ...` when it applies.
  - `Co-Authored-By: ...` when Claude helped.
- One work item per commit. Commits in the middle of the work are fine; with
  squash merge only the PR title and description reach `main`.

### PR title and description

- Title: the same as the commit subject.
- Write for a reviewer, or someone reading the history later, who has not read
  the spec. Lead with what changes for staff or owners, not a list of files.
- Sections, in this order:
  - **Summary:** what changes and why, in 2 to 4 sentences.
  - **Changes:** grouped by area (server, data, client, tests, workflow).
  - **How it was verified:** the Verify summary lines, what `/check` showed, and
    whether `/audit` ran and which findings it closed.
  - **Reviewer notes:** what to look at closely, and any trade-off made.
  - **Deploy notes:** env vars, migrations to run, settings, or "none".
  - **History:** the `blueprint/history/` file for this work.

### Merging

Merge PRs with **squash merge**, using the PR title as the commit subject, so
each work item lands on `main` as one conventional commit, with the PR number
added as `(#<n>)`. That keeps the history and GitHub's generated release notes
readable.

Protect `main`: require a pull request before merging, and require the CI checks
"Server tests" and "Client lint, build and tests" to pass. Nothing then reaches
`main` without review and green CI.

Squash merge and branch protection are GitHub repository settings; nothing in
the repo enforces them.
