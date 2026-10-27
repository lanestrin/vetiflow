# Feature: Sign-in screen

**From build-plan:** feature S.18a
**Status:** complete
**Branch:** `feature/sign-in-screen`
**Audit:** recommended - new client code that handles credentials and stores a session token (`vetiflow.client/src`)

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

Anyone can open `/sign-in`, sign in with a demo account by email, see "You're
all set" with the experience their account belongs to, and continue to the
board or a pet parent welcome. This is the first visible piece of the sign-in
demo (project plan section 10).

## Design reference

- `blueprint/reference/vetiflow-login-mock.html`: layout, copy, tabs, the
  "Try the demo" panel, the success panel and the 800 and 650 px breakpoints.
  Built to "Responsive and accessible design" in `coding-standards.md`, which
  wins where the mockup falls short (see Notes).

## In scope

- **`/sign-in` page**, laid out as the mockup:
  - **Brand panel.** The "+" mark and VetiFlow, the "Care, connected"
    eyebrow, "Care moves fast. Stay in sync." and its line, the care card,
    and the footer line. Decorative parts are hidden from screen readers.
  - **Form side.** A top bar with a Help link, "Welcome back" and its
    subheading, the Email / Phone tabs, the "Secure access" note, a "Try the
    demo" panel with the sample accounts, "New to VetiFlow? Ask your hospital
    team for an invite.", and "Proof of concept · Demo accounts only".
  - The mockup's fake "All systems operational" status is left out: the page
    can't know that.
- **Email tab:**
  - "Email address" and "Password" fields, "Forgot password?" and "Sign in".
  - Field errors are shown before sending, linked to their fields:
    - empty email: "Enter your email address."
    - not an email: "Enter an email address like you@example.com."
    - empty password: "Enter your password."
  - While sending, the button is disabled and says "Signing in…".
  - Messages from the API's `code`, announced to screen readers:
    - `unknownAccount`: "We couldn't match that demo account. Try one of the
      sample emails below."
    - `wrongPassword`: "Use welcome1 for this demo account."
    - `inactiveAccount`: "This demo account is turned off."
    - server or network error: "Sign-in isn't available right now. Try again
      in a moment."
  - "Forgot password?" shows "Password reset is a placeholder in this no-cost
    demo."
- **Phone tab:** selectable and keyboard reachable. It says "Phone sign-in
  with a demo code is coming next." until S.19 replaces it.
- **Tabs:** follow the ARIA tabs pattern: `tablist`, `tab`, `tabpanel`, arrow
  keys move between them, and the selected tab is shown by more than colour.
- **Help:** opens and focuses the "Try the demo" panel.
- **Success:**
  - The token from `POST /api/auth/email` is saved in `sessionStorage`, then
    `GET /api/auth/me` gives the name and experience.
  - The form is replaced by the success panel: heading "You're all set", then
    "Welcome to your care team" for a team member or "Welcome back" for a pet
    parent.
  - The line names the person, "Signed in as Jordan Lee."
  - "Continue as Hospital team member" or "Continue as Pet parent" goes to
    `/er` or `/pet-parent`.
  - "Back to sign in" clears the session and shows an empty form.
  - Focus moves to the success heading.
- **`/pet-parent`, simple:** "Welcome back, Morgan Hale" from `/api/auth/me`,
  with "Your pet's care updates will appear here." When there is no session,
  it says "Sign in to see your pet's updates" with a link to `/sign-in`.
- **Demo label** on every page: a slim "Demo · fictional data only" bar above
  the routes.
- **Responsive:** two columns above 800 px; narrower columns between 650 and
  800; stacked below 650, with the care card and brand footer hidden. It
  works at 320 px with no horizontal scroll, at 200% text and 400% zoom,
  and by keyboard alone.
- **Brand tokens** in `_tokens.scss`: navy `#12343d`, teal `#126b65` and mint
  `#e1f3ed` (the mockup's and the favicon's), since the page, the favicon
  and later pages share them.

## Out of scope

- Locking the board, sending the token on board requests, guards, `/`
  routing by role, sign out on the board and "session ended" (S.18b). `/er`
  stays open and `/` still opens the board.
- The pet parent's pets (S.18c); phone sign-in (S.19).
- Server changes: none needed (S.17 provides both endpoints; CORS already
  allows the `Authorization` header).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - auth service and session** - `services/authApi.ts`:
  `signInByEmail(email, password)` returns the token or the failure `code`
  (an `unavailable` result for network errors and `5xx`), and
  `getSignedInUser(token)`. `services/session.ts`: save, read and clear the
  token in `sessionStorage`, each read and write in `try`/`catch` so blocked
  storage reads as "no session". Types in `types/Auth.ts`. *Done when:*
  `authApi.test.ts` passes:
  - the request is a JSON `POST` to `/api/auth/email`
  - a `200` gives the token
  - each `401` code is returned
  - a `500` or a network error gives `unavailable`
  - `getSignedInUser` sends `Authorization: Bearer`

  `session.test.ts` covers save, read, clear, and storage that throws.
- [x] **Step 2 - sign-in page** - `routes/SignInPage.tsx` with
  `components/auth/SignInBrandPanel`, `EmailSignInForm` and `SignInSuccess`,
  SCSS modules, the brand tokens, and the `/sign-in` route. *Done when:*
  `SignInPage.test.tsx` passes:
  - each field error shows on its field
  - each API code shows its message, and so does `unavailable`
  - the button is disabled with "Signing in…" while waiting
  - success for each demo account shows its success heading and its
    "Continue as …" button
  - Continue goes to `/er` or `/pet-parent`
  - "Back to sign in" clears the session
  - "Forgot password?" shows its message
  - the tabs switch with the arrow keys and the Phone tab shows its notice
  - Help opens the demo panel

  All queries are by role and label.
- [x] **Step 3 - pet parent welcome and demo bar** -
  `routes/PetParentHomePage.tsx`, `components/layout/DemoBar.tsx` rendered
  by `App` above the routes, and the `/pet-parent` route. *Done when:*
  `PetParentHomePage.test.tsx` passes (a session shows "Welcome back, Morgan
  Hale"; no session shows the sign-in link), `App.test.tsx` passes (it shows
  the demo bar on every route, and `/sign-in` and `/pet-parent` render), and
  the board tests still pass.

## Files / areas

- `vetiflow.client/src/services/authApi.ts`, `session.ts` and their tests (new)
- `vetiflow.client/src/types/Auth.ts` (new)
- `vetiflow.client/src/routes/SignInPage.tsx`, `PetParentHomePage.tsx`, their
  modules and tests (new)
- `vetiflow.client/src/components/auth/` (new: brand panel, email form,
  success panel), `components/layout/DemoBar.tsx` (new)
- `vetiflow.client/src/app/App.tsx` and its test
- `vetiflow.client/src/styles/_tokens.scss`

## Data / contracts

- None new. The client uses S.17's contract:
  - `POST /api/auth/email` returns `{ accessToken, expiresIn, ... }`, or
    `401` with `code`
  - `GET /api/auth/me` returns `{ name, experience }`
- Client storage: `sessionStorage["vetiflow.session"]` holds the access
  token. It is per tab and gone when the tab closes.
- Experience labels live in the client: `teamMember` is "Hospital team
  member" and `petParent` is "Pet parent".

## Security

- The password is sent only to `POST /api/auth/email` and never stored,
  logged or kept in state after the request.
- The token lives in `sessionStorage`, which injected script could read.
  The CSP in 8.2 guards against that (project plan section 10 limits).
- Only fictional data appears; the sample credentials are shown on purpose.
- `/pet-parent` shows only the signed-in owner's own name from the token.

## Testing

- Client (Vitest, RTL, MSW): `authApi.test.ts`, `session.test.ts`,
  `SignInPage.test.tsx`, `PetParentHomePage.test.tsx`, `App.test.tsx`.
- Server: none (no change).
- `/check guide`: steps for you in a browser.
  - Sign in as each demo account, try each error, and use the page by
    keyboard.
  - Check it at 320 px, tablet and desktop widths, and at 200% zoom.
  - The deployed demo needs the demo accounts: one Render deploy with
    `Database__SeedDemoData=true`, then turned off.

## Notes for the AI

- **Where the standards beat the mockup:**
  - The mockup's 9–11 px text and some grey-on-white pairs (for example
    `#9aa9a8` on `#fbfcfa`) fail AA. Use `rem`, at least 0.75rem for small
    print, and colours that reach 4.5:1.
  - White on the mockup's teal `#16877d` is about 4.4:1, so buttons use the
    darker `#126b65`.
  - Keep the layout and spacing.
- No inline styles (the mockup has some); no `!important`; `@use` only.
- Wrap every `sessionStorage` access in `try`/`catch`.
- The password lives only in its field's state: never copied elsewhere, and
  cleared once sign-in succeeds or "Back to sign in" is chosen.
- Use React 19's `<title>`: "Sign in · VetiFlow" and "Welcome · VetiFlow".

## Result

- **Prepared:** branch `feature/sign-in-screen`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T01:27:24Z, feature/sign-in-screen @ 1f68bd3)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** step 1, `authApi` and `session` tests 12/12; step 2, `SignInPage` tests 15/15; step 3, all client tests 82/82, lint and build clean. The first full Verify failed one run of the success-focus test (focus moves in an effect just after the heading renders); the test now waits for focus, and passed five repeat runs and the full Verify.
- **Beyond the listed files:** `components/auth/PrimaryButton` (the shared teal button, so no component borrows another's classes) and `components/auth/experienceLabels.ts` (labels in their own file for fast refresh).
- **Check:** not run by Claude (no browser tool). A "Try it now" guide was given for both demo accounts, every message, 320 px and 200% zoom, and keyboard use; the person did not report results before `/complete`.
- **Audit:** recommended, not run (client code handling credentials and a session token)
- **Follow-ups added to build plan:** none (S.18b and S.18c were added with the split)
- **Deploy notes:** none in code. To demo on the deployed site, the database needs the demo accounts: one Render deploy with `Database__SeedDemoData=true`, then turn it off.
