# Fix: Plan the sign-in proof of concept

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/sign-in-poc-plan`
- **Audit:** not needed - planning docs only (`build-plan.md`, `project-plan.md`); no application code, config or data

## The problem

You asked for a demo sign-in experience: one responsive screen with Email
and Phone options, routing each account to the hospital team or pet parent
experience by its account record, with a simulated one-time code and no paid
service. The plan has no item for it.

What exists today (checked 2026-10-26):

- **No authentication at all.** No `AddAuthentication`, no account table, no
  sign-in route. Every endpoint is anonymous, including the board and the
  stage update (build plan M2 intro).
- **People exist without accounts.** `StaffMember` (name, `StaffRole`,
  `IsActive`) and `Owner` (name, optional phone and email) are seeded with
  fictional data (`DbSeeder.cs`: Jordan Lee and Priya Shah, veterinarians; Sam
  Ortiz and Alex Kim, technicians; owners Morgan Hale, Casey Rivera and Taylor
  Brooks with 555-01xx numbers and example.com addresses). The seeder skips
  everything once any case exists, so new seed rows need their own check.
- **Client:** React Router with `/` redirecting to `/er` (the board). No
  owner route.
- **Hosting:** client on Vercel, API on Render: different sites, so a session
  cookie would be a third-party cookie, which browsers increasingly block.
- **Plan:** S.5 (staff login) waits on the open login-provider decision; S.8
  and 6.3 (owner access and page) wait on the owner-access decision; S.15 has
  invitations and recovery; S.14 session timeout; S.9 rate limiting.
- **Design:** no login mockup in the repository (`blueprint/reference/` has
  only its README). Coding standards say UI that recreates a design is built
  against a screenshot there.

## The fix

Add the proof of concept as its own milestone, and the product detail it
needs to the project plan. No code.

### Approach (free, no new service)

- **Accounts in our own database.** A new `Account` table links a sign-in to
  exactly one `StaffMember` (hospital team member) or one `Owner` (pet
  parent). The role comes from that link, never from the email address.
- **Passwords** hashed with ASP.NET Core's built-in `PasswordHasher<T>`
  (part of the shared framework; no new package, no Identity tables).
- **Session:** ASP.NET Core's built-in bearer token (`AddBearerToken`), kept
  by the client in `sessionStorage` and sent as an `Authorization` header.
  This avoids the cross-site cookie problem between Vercel and Render, and
  needs no CSRF protection. The tab forgets it when closed, which suits a
  shared workstation.
- **Phone code:** simulated. No text is sent. When `DemoSignIn:Enabled` is
  `true`, the code `123456` verifies any number that belongs to an account.
  When it is not set, phone sign-in is refused.
- **Demo accounts** are seeded with fictional data only, and the sign-in
  screen lists them with the shared demo password, so anyone trying the demo
  can use them.

### build-plan.md

- New section **"M3a: Sign-in proof of concept (demo)"** at the start of M3,
  with one line: free local simulation; may be built alongside M2; not
  production authentication; the details are in project plan section 10.
  Items, in build order:
  1. **S.16** `feature/demo-accounts`: `Account` entity and migration (RLS and
     `AppRoleAccess.Grant`), password hashing, seeded demo accounts for both
     roles, with database tests.
  2. **S.17** `feature/demo-email-sign-in`: `POST /api/auth/email`
     (email and password to a bearer token), `GET /api/auth/me` (name and
     experience), and the board and stage endpoints require a hospital team
     member (`401` signed out, `403` for a pet parent).
  3. **S.18** `feature/sign-in-screen`: `/sign-in` with the Email option, demo
     labelling, the role routing, a minimal pet parent home, sign out, route
     guards and session-ended handling. Needs the login mockup in
     `blueprint/reference/`.
  4. **S.19** `feature/demo-phone-sign-in`: `POST /api/auth/phone/start` and
     `POST /api/auth/phone/verify` with the fixed demo code behind
     `DemoSignIn:Enabled`, plus the Phone option on the screen.
- Existing items now point at the proof of concept:
  - **S.5** builds on it: production sign-in per the login-provider decision,
    replacing or hardening S.16 and S.17.
  - **S.8** and **6.3** replace the minimal pet parent home.
  - **8.10** turns demo sign-in off in production: `DemoSignIn:Enabled` is set
    only in the demo environment, and production holds no demo accounts.
- **Decisions:** add "Sign-in proof of concept (decided 2026-10-26): local
  accounts, built-in password hashing and bearer tokens, a simulated phone
  code; no paid service." The login-provider and owner-access decisions stay
  open for production.

### project-plan.md

- **Section 10, "Sign-in proof of concept (demo)"**, new:
  1. **Accounts and roles.** `Account` has:
     - `Id`
     - `Kind` (`TeamMember` or `PetParent`, stored as text)
     - `StaffMemberId` or `OwnerId`: exactly one is set and it matches
       `Kind`, enforced by a check constraint; foreign keys restrict deletes
     - `Email`: optional, unique, stored lower-case
     - `PhoneNumber`: optional, unique, stored as `+1` and 10 digits
     - `PasswordHash`: set for accounts that can use email
     - `IsActive`
     - `CreatedAt`

     At least one of email and phone is set. Team members' clinical roles
     (veterinarian, technician) stay on `StaffMember` for S.6.
  2. **Demo accounts.** All fictional, and seeded only when
     `Database:SeedDemoData` is on and no account exists yet:
     - Jordan Lee, hospital team member: email `jordan.lee@example.com` and
       phone `+1 555-0110`.
     - Sam Ortiz, hospital team member: email only.
     - Morgan Hale, pet parent: email `morgan.hale@example.com`.
     - Casey Rivera, pet parent: phone `+1 555-0102` only.

     Team members and pet parents use the same `example.com` domain, which
     shows the role comes from the account, not the address. One shared
     password is shown on the screen.
  3. **Screens and states.** One `/sign-in` page with an Email / Phone switch:
     - **Email:** email and password fields; "Signing in..." with the button
       disabled; missing or badly formed input, shown at the field.
     - **Phone:** number field, then "Send code", then a code step with
       "Use a different number" and "Send again" (both simulated); a "Demo
       code: 123456" hint.
     - **Errors:**
       - "That email and password don't match a demo account."
       - "That code doesn't match. Check the number and code, then try
         again."
       - "Sign-in isn't available right now. Try again in a moment." (server
         or network error)
       - "Your session ended. Sign in again." (on a `401` after sign-in)

       Errors are announced to screen readers (`aria-live`).
     - **Success:** a team member goes to `/er` (the board, with "Signed in as
       ... (demo)" and Sign out); a pet parent goes to `/pet-parent` (a calm
       welcome with their own pets' names and whether each is in care, no
       acuity, no IDs in the URL).
     - **Guards:** signed out, any page goes to `/sign-in`. Signed in,
       `/sign-in` goes home. A pet parent who opens `/er` goes to
       `/pet-parent`.
     - **Demo labelling:** a "Demo" banner on every page, and the demo
       accounts listed on the sign-in screen.
  4. **Acceptance criteria:**
     - Each role signs in by email and by phone and lands on its own
       experience. No role is chosen during sign-in.
     - A wrong password, an unknown email, an unknown number and a wrong code
       each show their message and keep the user on the screen.
     - No text is sent and no SMS service is called. With
       `DemoSignIn:Enabled` unset, phone sign-in is refused.
     - A pet parent can't load the board: the page redirects, and the API
       answers `403`.
     - The layout works at 320 px, tablet and desktop widths with no
       horizontal scroll, and fully by keyboard.
     - Only fictional data appears.
  5. **Assumptions and production limits to revisit:**
     - Messages don't say whether an account exists, which avoids account
       enumeration. They still say what to try next.
     - The fixed code and the shared password shown on screen are demo-only:
       never in production with real data (8.10).
     - Tokens are kept in `sessionStorage`. That needs the CSP in 8.2 against
       script injection.
     - Data protection keys are lost when the container restarts, so a
       redeploy signs everyone out. Production keeps the keys, or uses the
       chosen provider.
     - Not yet included:
       - rate limiting and lockout (S.9)
       - session timeout and lock (S.14)
       - invitations, recovery and deactivation (S.15)
       - hub sign-in (S.7)
       - per-role permissions (S.6)
     - Production phone sign-in needs an SMS provider, which costs money and
       needs its own decision. Production pet parent access follows the
       owner-access decision (S.8).
- **Section 2 (Users):** pet parents can sign in to the demo; production
  access stays per S.8.
- **Section 4 (Data):** add `Account` (S.16).
- **Section 7 (Routes):** `/sign-in`, `/er`, `/pet-parent`.

Must not change: existing IDs, completed lines, history files, application
code.

### Changes after the mockup (2026-10-26)

You added `blueprint/reference/vetiflow-login-mock.html` with the OK. The
plan follows it where it differs from the text above, and the mockup is
committed with this branch:

- **Demo accounts:** two instead of four, as in the mockup, each with email
  and phone. `team@vetiflow.demo` (Jordan Lee) with 312-555-0101, and
  `parent@vetiflow.demo` (Morgan Hale) with 312-555-0102, both with password
  `welcome1`.
- **No-match messages:** the mockup's direct wording ("We couldn't match that
  demo account...", "Use welcome1 for this demo account.", "Use 123456 for
  this demo."). The "don't reveal accounts" rule moves to the production
  limits (S.5).
- **States added from the mockup:** the "You're all set" success panel with
  "Continue as ..." and "Back to sign in", the "Forgot password?"
  placeholder, the Help link, "Demo verification is ready. No text was sent.",
  and its 800 and 650 px breakpoints.
- **S.18** names the mockup instead of "needs the login mockup".

## Build steps

- [x] **Step 1 - build plan.** Add M3a with S.16 to S.19, the pointers on
  S.5, S.8, 6.3 and 8.10, and the decision. *Done when:* the new IDs are unique,
  every old ID is still present once (the ID check from the roadmap fix), and
  no completed line changed.
- [x] **Step 2 - project plan.** Add section 10 and the section 2, 4 and 7
  notes as above. *Done when:* section 10 covers accounts, demo accounts,
  screens and states, acceptance criteria and limits, and nothing else in the
  file changed.

## Verify

- The one-off ID check against `main` (scratchpad script, not committed).
- `scripts/verify.ps1 -ReuseIfCurrent` passes.
- Nothing to observe in the app; `/check` is skipped.

## Result

- **Prepared:** branch `fix/sign-in-poc-plan`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-26 (reused from 2026-10-26T23:26:19Z, fix/sign-in-poc-plan @ 646ee75)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **ID check:** every ID in `main`'s build plan appears once; S.16, S.17, S.18 and S.19 added; no duplicates; ticked lines unchanged.
- **Beyond the first draft:** aligned with `blueprint/reference/vetiflow-login-mock.html` (see "Changes after the mockup"); the mockup is committed with this branch.
- **Check:** not run - docs only
- **Audit:** not needed
- **Follow-ups added to build plan:** M3a (S.16 to S.19)
- **Deploy notes:** none
