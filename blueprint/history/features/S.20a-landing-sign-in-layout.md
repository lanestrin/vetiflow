# Feature: New sign-in landing layout

**From build-plan:** feature S.20a
**Status:** complete
**Branch:** `feature/landing-sign-in-layout`
**Audit:** not needed - restyles an existing page; no new endpoint, data or sign-in rule

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

`/sign-in` looks like the stakeholders' new landing design on desktop, tablet
and phone. Every sign-in behaviour from S.18 and S.19 stays exactly as it is:
email, phone with the demo code, messages, success panel, guards and the
session-ended notice.

## Design reference

- `blueprint/reference/landing-page/desktop-preview.png` (1600×900): the
  picture to build against on desktop.
- `blueprint/reference/landing-page/index.html` and `app.js`: wording,
  structure and icons.
- `blueprint/reference/landing-page/README.md`: the designer's notes, including
  the palette and "same image reused as a hero on tablet and mobile".
- The background art, updated by the designer on 2026-10-27, lives only in
  the app: `vetiflow.client/src/assets/sign-in/background-1x.webp` (1672×840)
  and `background-2x.webp` (3344×1680). The photo runs to the right edge
  behind the card, with no hard cut. The first art, the 2.6 MB PNG source and
  the designer's `site-config.js` were removed as unused.
- The logo: `vetiflow.client/src/assets/sign-in/paw.svg`, from the
  designer's `assets/paw.svg`.
- **Missing from the handover:** the designer's `styles.css` and
  `mobile-preview.png`. The tablet and phone layouts below are ours,
  designed from the README notes (decided 2026-10-27). If the files arrive
  before building starts, match them.

## In scope

- **Whole page:**
  - One continuous background art layer behind the desktop layout. It is
    decorative (`aria-hidden`, no text in the image), WebP at 1x and 2x
    (`image-set()`), and bundled by Vite from `src/assets/sign-in/`.
  - The story sits on the cream on the left, the animals in the middle, and
    the card floats over the room photo on the right. The art covers the
    whole page, anchored so the animals stay between the story and the card.
  - Palette from the design, used only on this page: navy `#1A2E40`, sage
    `#EAF2EE`, charcoal `#2B303A`, plus the green of "Stay in sync.". Global
    tokens stay as they are, so the board doesn't change.
- **Story side** (replaces `SignInBrandPanel`'s navy panel):
  - The paw logo (from `paw.svg`), "VetiFlow" and the "VETERINARY CARE. IN
    SYNC." kicker.
  - The "CARE, CONNECTED" pill and the headline "Care moves fast." / "Stay in
    sync." (second line green).
  - The lead, the three benefits with their icons and descriptions:
    - "Care updates, all in one place": "Your hospital team is here when you
      need them."
    - "Less phone tag": "Secure messaging and real-time updates."
    - "A more connected care experience": "For healthier, happier pets."
  - "THOUGHTFUL CARE. CLEAR COMMUNICATION." at the bottom.
  - The page's single `h1` stays the card heading ("Welcome back" / "You're
    all set"), so the existing focus and tests hold. The story headline is a
    styled paragraph, as now.
- **Card:** a white rounded card with a soft shadow on the right, holding
  what the page has today, restyled to the design:
  - Help at the top right.
  - Email and Phone tabs with their icons.
  - Fields with a leading icon (envelope, lock, phone).
  - "Forgot password?" beside the password label.
  - A navy "Sign in →" button.
  - The "SECURE ACCESS" divider, the shield note, "Try the demo",
    the invite line and "Proof of concept · Demo accounts only".
- **Show password:** an eye button inside the password field.
  - It toggles the field between hidden and shown.
  - `aria-label` is "Show password" or "Hide password", with `aria-pressed`.
  - It is at least 44×44 px.
- **Kept from S.18/S.19, not the design:**
  - Our phone flow: number, then the code step with 123456.
  - Our demo panel with the phone numbers and the code.
  - The email field starts empty. The design pre-fills
    `team@vetiflow.demo`, but the demo panel already shows the accounts.
- **Tablet (about 41–64rem):** the art becomes a hero across the top,
  cropped to the animals, with the brand and headline. Then the card centred
  below it, then the benefits.
- **Phone (under about 41rem):**
  - A short art band (about 12rem) with a soft fade into the page colour,
    with the paw and "VetiFlow" above it.
  - Then the headline, the card at full width with 1rem side gutters, and the
    benefits last.
  - No horizontal scroll at 320px; text stays readable at 200% zoom.

## Out of scope

- The emergency bar (S.20b).
- The paw as the browser favicon (an app-wide brand choice; ask first).
- A separate portrait art file: the 2x art crops well enough to the animals
  for the tablet and phone heroes.
- Any change to sign-in endpoints, messages or the success panel's behaviour.

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - story side and art** - copy the art and paw into
  `src/assets/sign-in/`. Rebuild `SignInBrandPanel` as the new story, and lay
  out the page shell with the background art for desktop, tablet and phone.
  *Done when:*
  - `SignInBrandPanel.test.tsx` (new) finds the brand, the headline text and
    the three benefits by their words, and finds the art and icons hidden
    from screen readers.
  - Existing `SignInPage.test.tsx` passes unchanged; client lint and build
    pass.
- [x] **Step 2 - card restyle and show password** - card, tab and field icons,
  the navy button, the "Forgot password?" placement, and the eye button on the
  password field. *Done when:*
  - `SignInPage.test.tsx` adds "shows and hides the password": the button
    flips the input type, `aria-pressed` and its label.
  - Every existing sign-in test still passes, and all client tests, lint and
    build pass.

## Files / areas

- `vetiflow.client/src/assets/sign-in/` (new): `background-1x.webp`,
  `background-2x.webp`, `paw.svg`
- `vetiflow.client/src/components/auth/SignInBrandPanel.tsx`, its module and
  a new test
- `vetiflow.client/src/routes/SignInPage.tsx` and `SignInPage.module.scss`,
  `SignInPage.test.tsx`
- `vetiflow.client/src/components/auth/EmailSignInForm.tsx`,
  `PhoneSignInForm.tsx` (field icons), `SignInForm.module.scss`,
  `PrimaryButton.module.scss` (the navy button, if shared only with sign-in)
- `blueprint/project-plan.md` section 10: the page description points to the
  new design.

## Data / contracts

- None.

## Security

- No new surface. The design's `site-config.js` and its `signInEndpoint`,
  cookie and redirect code are not used: sign-in stays on our API.
- No external fonts, scripts or images. The art is bundled with the app.

## Testing

- Client:
  - `SignInBrandPanel.test.tsx` (new).
  - `SignInPage.test.tsx`: the show-password test, and all existing tests.
- Layout and colours are not unit tested (coding standards). Check them in
  the browser.
- `/check`:
  - The page at 1600, 1280, 1024, 768, 390 and 320 px wide.
  - Keyboard: through the tabs, fields, eye button and demo panel.
  - 200% zoom.
  - A grayscale view: the selected tab still shows without colour.
  - Sign in by email and by phone once each.
  - The browser steps are yours if no browser tool is available.

## Notes for the AI

- Inter is already the app font; the design's headline weight and tight
  letter spacing go on this page's classes only.
- Keep contrast AA:
  - the green headline line on cream
  - the grey kicker and caption text (darken it if it fails 4.5:1)
  - field borders at least 3:1
- Use `image-set()` for the 1x and 2x WebP, and set a cream background colour
  under the art so nothing jumps while it loads. No JPEG fallback: every
  browser the app supports reads WebP.
- The card sits over the photo: keep it solid white, so text contrast never
  depends on the art.
- Keep the existing component split (`EmailSignInForm`, `PhoneSignInForm`,
  `SignInSuccess`). Add small presentational pieces only where a file gets
  hard to read (for example `BenefitList`).

## Build notes

- **Breakpoint at 85rem, not 64rem:** the side-by-side layout needs the
  animals to fit between the story and the card. Below 1360px they would sit
  under the card, so tablets and small laptops get the stacked layout.
- **The art is one screen tall on wide screens**, not as tall as the page.
  The card can make the page taller than the screen, and growing the art with
  it pushed the dog under the card. The art's foot fades into the page.
- **`SignInStory.tsx` replaces `SignInBrandPanel`:** three pieces
  (`SignInBrand`, `SignInStory`, `SignInBenefits`) so the page grid can put
  the card between them on narrow screens. The test is
  `SignInStory.test.tsx`; `SignInPage.test.tsx` also checks that nothing
  decorative is announced as an image.
- **Shared icons** in `components/auth/signInIcons.tsx`.
- **Help** sits in the card's top corner on every size.
- **Workflow test fix:** `scripts/tests/secrets-config.tests.ps1` now skips
  tracked client files that are deleted in the working tree. Before, deleting
  any client file failed Verify until the commit.
- **Screenshots:** headless Chrome against `vite preview` at 2560×1080,
  1920×1080, 1600×900, 1440×900, 1366×768, 1024×768 and 768×1024, plus 430,
  390 and 320 px through an iframe. There is no sideways scroll at 320px, and
  the dog's face is clear of the card from 1366px up.

## Result

- **Prepared:** branch `feature/landing-sign-in-layout`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (ran)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:** client 127/127 across all files, lint, types and build clean. The first full Verify failed in the workflow tests on the deleted `SignInBrandPanel` files; fixed in `secrets-config.tests.ps1` (see Build notes).
- **Check (headless Chrome against `vite preview`):** screenshots at 2560×1080, 1920×1080, 1600×900, 1440×900, 1366×768, 1024×768, 768×1024, and 430, 390 and 320 px wide through an iframe (headless Chrome won't size a window below about 500 px). The first round showed the dog under the card at 1280 px and a thin cream strip at 2560 px; both fixed (85rem breakpoint, screen-tall art, corrected right-edge maths). Sign-in itself is covered by the unchanged `SignInPage` tests. Keyboard, 200% zoom and grayscale browser steps not run (no interactive browser tool).
- **Cleanup:** unused design files removed from `blueprint/reference/` (first art, PNG source, duplicate WebPs, `site-config.js`, a stray `paw.svg`); the old `vetiflow-login-mock.html` stays because history files and tokens link to it.
- **Audit:** not needed (restyle only; no endpoint, data or sign-in rule)
- **Follow-ups added to build plan:** none (S.20b, the emergency bar, was planned with this item)
- **Deploy notes:** none (no migration or setting; the art is bundled, about 60 KB at 1x and 150 KB at 2x)
