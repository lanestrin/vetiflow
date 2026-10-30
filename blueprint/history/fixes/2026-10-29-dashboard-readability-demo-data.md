# Fix: Dashboard readability and fuller demo data

**Type:** Fix
**Status:** complete
**Branch:** `fix/dashboard-readability-demo-data`
**Audit:** recommended - changes staff dashboard presentation and demo seeding on existing databases; no new endpoint, permission or schema.

## The problem

The user's 2026-10-29 screenshot shows an intrusive blue outline around the
selected patient card and very small clinical text. `PatientCard.module.scss`
uses a 13 px patient name, 10 px descriptions and metadata, 9 px tags and
8 px initials. Its `:focus-within` outline uses the blue `--color-focus`.

The user also wants the large "ER Command Center" heading below "Northside
Veterinary Emergency" removed. `BoardHeading.tsx` currently renders the
clinic as a small paragraph and that repeated label as the h1.

`DbSeeder.SeedCasesAsync` creates only Buddy, Luna and Max, and `SeedAsync`
skips that entire method once any case exists. Adding more entries only to
that method would leave the already-seeded demo with three cases. A fuller
board is needed to inspect wrapping, density and long lanes.

## The fix

### Heading, focus and typography

- Remove the large "ER Command Center" line from the dashboard heading.
  Promote the clinic name from the summary to the page h1, approximately
  1.5rem with wrapping. While the summary is unavailable, use the accessible
  fallback "Emergency board". Keep New intake, the shift chip and subtitle
  working and aligned at narrow widths.
- Replace the blue card outline with the existing dark care teal
  (`--color-focus-on-light`) and coordinated mint treatment. Preserve a
  clearly visible keyboard-focus outline and the existing selected-card
  border. Apply the same focus treatment to light dashboard controls where
  they currently use the blue ring, scoped to the dashboard components.
  Dark navigation surfaces keep a sufficiently contrasting focus treatment.
- Review the ER board and patient overview together at 100% browser zoom.
  Proposed type scale, subject to the visual check: patient names 1rem
  (16 px at the default root size), main complaint/action text 0.875rem
  (14 px), supporting metadata 0.8125rem (13 px), compact tags and labels
  at least 0.75rem (12 px). Vitals and pain values use the larger readable
  scale. Use unitless line heights and allow cards to grow and text to wrap.
  Do not enlarge the page with CSS zoom or transforms.
- Maintain the existing three lanes, acuity colours and responsive behavior.
  Check the new density with full lanes at desktop, tablet and phone widths,
  including 320 CSS pixels, 200% text resizing and 400% browser zoom.
  Preserve semantic headings, accessible names, focus order and contrast.

### Demo cases

- Expand the fresh demo seed to 18 active cases: six Critical, six Urgent
  and six Stable. Preserve the three original fixtures and add 15 known
  fictional cases with stable fixture identities.
- Add those missing fixtures to already-seeded demo databases when the
  existing `Database:SeedDemoData` path runs. Use identity checks, not a
  count-based "fill to 18" loop or patient names, so repeated startup never
  duplicates cases or mistakes a manually entered patient for a fixture.
- Do not erase or overwrite existing cases, people or accounts, or revive
  discharged/modified fixtures. Existing extra records remain. The exact
  lane counts on an edited demo can therefore differ from the fresh seed.
  Preserve the existing demo-time refresh behavior.
- Include dogs and cats, short and long patient/breed/complaint text, varied
  stages and wait times, provisional arrivals, assigned and unassigned care,
  blockers, due items, and recorded vitals/pain values. Give fresh fixtures
  enough clinical detail to inspect the panel, including partial readings.
  Maintain the existing original patients' demo relationships and account
  links. Use only fictional contacts, `example.com` and 555-01xx numbers.
- Set acuity through `EmergencyCase.RecordTriage`. Do not assign a room to
  two active cases. Reuse existing seeded clinicians where available without
  creating duplicate people or altering their current status.
- Keep seeding behind the existing opt-in flag. No migration, public seed
  endpoint, new setting or production connection access. To populate the
  hosted demo, document the deliberate Render deploy with demo seeding
  enabled; an ordinary redeploy with seeding off will not add records.
  Production configuration and data are not changed during implementation.

## Build steps

- [x] **Step 1 - Regressions** - update the heading contract test to expect
  the clinic as h1 and no repeated large title; add real-Postgres seed tests
  for a fresh 18-case board, backfilling an older three-case database,
  repeated seeding and preserving edited/discharged or manually entered
  records. *Done when:* the new expectations fail on current behavior for
  the intended reasons, with no disabled or skipped tests.
- [x] **Step 2 - Dashboard presentation** - change the heading, dashboard
  focus treatment and small type sizes in the owning SCSS modules.
  *Done when:* heading/card/board/panel behavior tests pass and the running
  dashboard shows the clinic heading, teal keyboard focus and readable
  text without clipped cards or lost controls.
- [x] **Step 3 - Repeat-safe demo expansion** - extend `DbSeeder` to add the
  missing synthetic fixtures to fresh and existing demo databases.
  *Done when:* the seed regressions pass against real Postgres, original
  account/owner-link and time-refresh tests remain valid, and a local board
  shows the fuller dataset across all lanes after two seed runs.
- [x] **Step 4 - Verify and visual check** - run `scripts/verify.ps1` for
  the full scope, then inspect the fuller board at 1440, 1050, 650 and 320
  pixels, enlarged text, 400% zoom, forced colours and keyboard navigation.
  *Done when:* automated checks pass, long lanes scroll naturally, long
  card text wraps, and patient selection and panel refresh still work.

## Files / areas

- `components/board/BoardHeading.tsx`, its SCSS and test.
- `components/board/PatientCard.module.scss`, board/filter/stats SCSS and
  overview SCSS as needed for the consistent dashboard type scale.
- `components/overview/PainScorePanel.module.scss` for its small labels.
- `vetiflow.Server/Data/DbSeeder.cs` and
  `vetiflow.Server.Tests/Data/DbSeederTests.cs`.
- `blueprint/project-plan.md` only to record the user's revised dashboard
  design direction and the hosted-demo seeding procedure if clarification
  is needed. No global visual restyle of sign-in or pet-parent pages.

## Verify and design reference

- The user's attached card screenshot is the reference for the reported
  blue focus ring and small text. Use
  `blueprint/reference/vitals-pain-prototype.png` and the existing dashboard
  HTML for layout context. This request explicitly revises their heading,
  small type and blue focus treatment; those old details are not targets.
- Client tests: `BoardHeading.test.tsx`, `PatientCard.test.tsx`,
  `PatientFlowBoard.test.tsx`, `ErBoardPage.test.tsx` and
  `PatientOverviewPanel.test.tsx`. Update heading assertions in callers.
  Verify pure styling visually rather than adding CSS-value unit tests.
- Seed regressions: `SeedAsync_PopulatesEmptyDatabaseOnce` (18 cases, six per
  acuity, repeated seed), `SeedAsync_BackfillsAnOlderThreeCaseDatabaseOnce`
  and `SeedAsync_PreservesEditedDischargedFixturesAndUnrelatedData`.
- Never log clinical notes, owner contacts or connection strings. Browser
  and database checks use fictional local records and the guarded startup
  command. Record unavailable accessibility tooling honestly.

## Verification evidence (2026-10-29)

- Full `scripts/verify.ps1` run: PASS for workflow tests, server build,
  all 432 server tests, client lint, client production build and client tests.
  Visual acceptance is deferred to the user as explicitly requested below.

- Before implementation: BoardHeading had two expected failures (clinic h1
  and loading fallback); seeder tests had three expected failures (3 instead
  of 18 cases on fresh/legacy databases and missing additional fixture).
- After implementation: 52 focused client tests passed (BoardHeading, App,
  ErBoardPage). All 19 DbSeeder tests passed against disposable real Postgres.
  Fresh seed is 18 cases with six per acuity; repeat/backfill, edited and
  discharged fixture preservation, unrelated data, account/owner links and
  stale-time refresh checks pass.
- Guarded local API startup reported `Database target: local`. GET /api/cases
  and /api/board/summary returned 200 and agreed on 27 active cases (12 existing
  cases preserved plus 15 new fixtures). New fixtures split 5 Critical,
  4 Urgent and 6 Stable. After a second guarded startup, GET /api/cases still
  returned the same 27 IDs and 15 fixtures with zero ID differences; an
  additional fixture's case-detail endpoint returned 200.
- Browser visual checks are deferred to the user after publication, at the
  user's explicit request: "I don't need to see what it looks like. I will
  check once its publish". This revises Steps 2-4's visual Done when items;
  automated and API checks remain required. Computer Use had stopped because
  it could not determine the active browser URL confidently enough to enforce
  policy. No responsive, zoom, forced-colour, keyboard visual or screen-reader
  result is claimed.

## Queued work

The user also requested `/feature 4.8c`. Keep record vitals on its own
`feature/record-vitals` branch after this dashboard fix: a panel dialog for
4.8a's existing endpoint, optional readings/observations, at least one input,
Celsius-to-Fahrenheit conversion, bounded validation, safe save/error states
and live refresh. Its full spec is prepared next, before implementation.
Recording pain scores remains 4.8d. Neither recording form is built in this
fix branch.

## Result

- **Prepared:** branch `fix/dashboard-readability-demo-data`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1 -ReuseIfCurrent` on 2026-10-29, scope full (reused from 2026-10-30T02:27:25.2191663Z, fix/dashboard-readability-demo-data @ 4a207c4).
  - PASS Workflow tests
  - PASS Server build
  - PASS Server tests (432)
  - PASS Client lint
  - PASS Client build
  - PASS Client tests (498)
- **Check:** guarded local API startup reported `Database target: local` twice. GET /api/cases and /api/board/summary returned 200 and agreed on 27 active cases: 12 existing cases preserved plus 15 additional fixtures. The additional fixtures split 5 Critical, 4 Urgent and 6 Stable. After restart, all 27 case IDs remained unchanged with no duplicate fixtures; an additional fixture's case-detail endpoint returned 200. Real-Postgres tests prove a fresh seed has 18 cases, six per acuity. Browser visual, responsive, zoom, forced-colour, keyboard and screen-reader checks were not completed: Computer Use stopped on URL verification, then the user explicitly deferred visual acceptance until after publication.
- **Audit:** recommended, not run (dashboard presentation and existing-database demo backfill; user did not request an audit). No findings recorded.
- **Follow-ups added to build plan:** none. This is a fix; no planned feature was marked complete. Record vitals remains queued as 4.8c on its own branch.
- **Deploy notes:** deploy the client for heading, typography and focus changes. Deploy the API on Render with the existing `Database__SeedDemoData=true` flag enabled for the hosted demo to add the 15 missing fixtures. A deployment with this flag off does not add cases. No new setting or schema migration. Hosted configuration and data were not changed during implementation; hosted results are not verified.
