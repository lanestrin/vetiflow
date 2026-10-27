# Fix: Tablet and phone sign-in layout with a blob background and a compact emergency bar

**Type:** Fix
**Status:** complete
**Branch:** `fix/sign-in-tablet-phone-layout`
**Audit:** not needed - layout and decoration on the sign-in page; no data, endpoint or sign-in rule change

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

This is part 2 of the sign-in review (2026-10-27). Part 1
(`history/fixes/2026-10-27-sign-in-form-behaviour.md`) steadied the card and
its forms. The wide layout (85rem and up) keeps its dog-and-cat composition
from S.20a and S.20c unchanged.

## The problem

Measured in headless Chrome against `vite preview` on main (`affb08e`):

1. **The photo band pushes the form down on narrow screens.**
   - Below 85rem, `SignInPage.module.scss` (`@media (max-width: 84.99rem)`)
     stacks brand, an `art` row, story, card and so on.
   - The art row is a hero band holding the photo blob (`bandLayout` in
     `SignInScene.tsx`), `clamp(14rem, 60vw, 26rem)` tall.
   - On a 390×844 phone the card starts at 541 px.
   - In phone landscape (844×390) the card starts at 789 px, two screens
     down.
   - On an 820×1180 tablet the card also starts at 789 px.
2. **Phones show all the marketing before the form.** The eyebrow, the
   headline and the lead paragraph all sit above the card.
3. **The art keeps animating when no one can see it.** `SignInScene` runs
   its animation frame loop whenever motion is allowed (it pauses only
   while the tab is hidden), even after the person has scrolled the art
   out of view.
4. **The emergency bar is tall where space is short.**
   - On narrow screens the heading, the line and two full-width buttons
     take about 200 px at the page's foot.
   - On short wide windows (1600×700) the sticky bar covers about 92 px of
     every screen.

## The fix

1. **A blob-only scene below 85rem** (`SignInScene.tsx`).
   - `bandLayout` is replaced by `heroLayout`: three or four solid mint
     shapes (the existing `mint`, `mintDeep` and `halo` colours) moving
     slowly. There is no photo and no dots, so text never sits on a dark
     shape.
   - The `<image>` renders only in the wide layout, so phones and tablets
     no longer download the photo.
   - The motion is slower than on wide screens: durations of about 6-10 s
     per breath.
2. **The story over the shapes** (`SignInPage.module.scss`, narrow block).
   - The `art` grid row is removed. The art becomes a layer behind the brand
     and story rows. It runs full-bleed to the screen edges, from the top
     of the page to the end of the story, and is clipped there.
   - Brand and story sit directly on it, and the card follows the story.
   - The card keeps its solid white surface.
   - The DOM order is unchanged (brand, story, card, benefits, tagline,
     emergency bar), so reading and keyboard order stay logical.
   - The art layer stays `aria-hidden` and gets `pointer-events: none`.
   - **Contrast:** every story colour (navy `#1a2e40`, muted `#556372`,
     green `#2e6b57`, eyebrow `#2a5a4a` on `#e3efe8`) is at least 4.5:1 on
     both the cream and the lightest and darkest mint fills. So contrast
     holds wherever a shape moves.
3. **Compact marketing.**
   - **Phones (up to 40.62rem):** the lead paragraph is hidden, the headline
     is smaller and the gaps are tighter. The eyebrow, the headline, the
     benefits and the tagline stay; the benefits are below the card, as now.
   - **Short narrow screens (phone landscape, `max-height: 30rem`):** the
     eyebrow is hidden too, so the card starts within the first screen.
4. **Stop hidden animation work.**
   - `useAnimationLoop` gets an `IntersectionObserver` check: the loop runs
     only while the scene is on screen. That covers scrolling away and an
     art layer hidden with `display: none`.
   - It keeps its existing pauses for hidden tabs and reduced motion. With
     no `IntersectionObserver` (tests, old browsers) it treats the scene as
     on screen.
5. **A compact emergency bar** (`EmergencyBar.module.scss`; the component
   and the demo notice are unchanged, so nothing dials or opens a map).
   - **Phones:** smaller padding and heading, the badge hidden, and both
     buttons on one row at 2.75rem (44 px) high. The line about calling the
     hospital stays: it is the safety message.
   - **Wide but short windows (`max-height: 45rem`):** the sticky bar
     tightens its padding and its buttons to 2.75rem high, and the line
     moves beside the heading at a smaller size. The cards'
     `scroll-margin-block-end` shrinks to match, so focused controls still
     clear it.
   - **Narrow screens:** the bar stays in normal flow, as now. An on-screen
     keyboard can then never push it over a field.
   - **Safe areas:** the viewport keeps the default `viewport-fit`, so
     browsers keep the page inside the safe area. The bar's padding adds
     `env(safe-area-inset-bottom)`, which is 0 today and correct if
     `viewport-fit=cover` is ever added. `index.html` is not changed.

Must not break:
- The wide layout and its photo composition from S.20a and S.20c.
- Part 1's steady card, its validation and its motion.
- The emergency bar's demo notice dialog, and the sticky bar on wide
  screens.
- Reduced motion: shapes drawn once, no loop.
- Every existing test.

## Build steps

- [x] **Step 1 - failing tests for the scene** - new `SignInScene.test.tsx`
  and `useAnimationLoop.test.tsx`. *Done when:* these fail against current
  code:
  - "draws no photo on narrow screens" (stubbed `matchMedia`; no `<image>`
    in the SVG)
  - "draws the photo on wide screens"
  - In `useAnimationLoop.test.tsx`: "pauses while the element is off
    screen" (a stubbed `IntersectionObserver` reports off screen, then on
    screen; frames run only while on screen)
- [x] **Step 2 - the blob-only hero and the on-screen check** -
  `SignInScene.tsx` (`heroLayout` in place of `bandLayout`) and
  `useAnimationLoop.ts` (an optional element to watch). *Done when:* step 1's
  tests and the existing `useAnimationLoop` and `livingBlob` tests pass.
- [x] **Step 3 - the narrow page layout** - `SignInPage.module.scss` and
  `SignInStory.module.scss`. *Done when:*
  - Client lint, build and all tests pass.
  - A headless Chrome probe at real time measures where the card starts:
    - 390×844: by 360 px, with the email field inside the first screen
    - 844×390: by 390 px
    - 820×1180: by 600 px
    - 320×640: no horizontal scroll
  - Screenshots show the story on the moving shapes at 390 and 820, and
    the wide layout unchanged at 1600×900.
  - A browser script computes contrast for each story text colour on the
    cream and each mint fill. All are at least 4.5:1.
- [x] **Step 4 - the compact emergency bar** - `EmergencyBar.module.scss`
  and the scroll margin in `SignInPage.module.scss`. *Done when:*
  - `EmergencyBar.test.tsx` passes unchanged.
  - The probe measures the bar's height at 390×844 (at most 150 px, both
    buttons on one row, each at least 44 px high) and at 1600×700 (at most
    72 px).
  - At 1600×700, the probe focuses the Sign in button with the keyboard
    and confirms it ends up above the bar.

## Verify

- **Client:** `SignInScene.test.tsx`, `useAnimationLoop.test.tsx`,
  `EmergencyBar.test.tsx`, `SignInPage.test.tsx` and the whole suite
  through `scripts/verify.ps1`.
- **Browser (headless Chrome, real time):**
  - Card start positions, bar heights, contrast and screenshots at 390×844,
    844×390, 820×1180, 320×640, 1600×900 and 1600×700.
  - With reduced motion emulated: no animation frames.
  - After scrolling the art out of view: no animation frames.
- **For the person to try:** a real phone in portrait and landscape,
  including the on-screen keyboard. Headless Chrome cannot show a real
  keyboard or safe areas.

## Build notes

- **Scene:**
  - `heroLayout` holds four pale shapes (`halo`, `mintDeep`, `mint`, `mintDeep`) with 6-10 s durations, no photo and no dots.
  - The photo's `clipPath` and `<image>` render only when a layout has an image.
  - Narrow screens draw with `xMidYMin slice`, because the layer is often wider than tall and the shapes sit near the scene's top.
- **Loop:**
  - `useAnimationLoop(onFrame, isRunning, element?)` runs only while the tab is shown and the watched element is intersecting. Without `IntersectionObserver`, the element counts as on screen.
  - `SignInScene` passes its own `<svg>` through a state ref.
  - The first draft of the off-screen test called a frame callback after it was cancelled, which a browser never does, so that line was dropped.
- **Narrow layout:**
  - The art spans `grid-row: brand-start / story-end`, full bleed, starting 1.25rem up so it reaches the page's top.
  - `contain: size` stops the SVG's aspect ratio from setting the rows' height. Without it, the first build put the card at 709 px on the tablet and 728 px in landscape.
  - The fade at the foot is a `mask-image`, not an overlay. The overlay left a 1 px mint line at the clip edge, seen by pixel sampling.
  - `.art` has `pointer-events: none` at every width.
- **Compact marketing:** phones hide the lead and use a 2-2.5rem headline. Narrow, short screens (`max-height: 30rem`) also hide the eyebrow and kicker.
- **Emergency bar:**
  - On phones the badge is hidden, the padding is 1rem and the buttons are 44 px high, on one row while they fit (`flex: 1 1 8.5rem`). They wrap at 320 px.
  - On wide but short windows (`max-height: 45rem`) the padding is 0.625rem, the badge 2.5rem and the buttons 44 px high, and the card's scroll margin is 5.5rem.
  - The bottom padding adds `env(safe-area-inset-bottom)`. `index.html` is unchanged.
- **Browser (headless Chrome over CDP, real time, `vite preview`):**

  | Size | Card top | Email field top | Bar height |
  | --- | --- | --- | --- |
  | 390×844 | 255 (was 541) | 483 | 133, buttons on one row at 44 px |
  | 844×390 | 219 (was 789) | | |
  | 820×1180 | 385 (was 789) | | |
  | 320×640 | 248 | | 152 (buttons wrap) |
  | 1600×900 | 65, unchanged | | 92, unchanged |
  | 1600×700 | | | 64 (was 92) |

  - **Other checks:**
    - No horizontal scroll at any size.
    - No `<image>` below 85rem; the photo is still there at 1600.
  - **Screenshots:** the story sits on the shapes at 390, 844×390 and 820, and the wide layout is unchanged.
  - **Contrast:** the lowest ratio is 4.86:1 (muted `#556372` on `mintDeep`). Navy, green and eyebrow text are all higher on cream, halo, mint and mintDeep.
  - **Keyboard at 1600×700:** Tab through the card. Help, the Email tab, the email field, Forgot password, the password field, Show password, Sign in and Try the demo all ended above the sticky bar (Try the demo scrolled up to 507 px; the bar starts at 636).
  - **Motion on the phone:** the shapes move on screen, stop when scrolled to the foot, move again back at the top, and stop with reduced motion emulated.
- **Not checked:** a real phone's on-screen keyboard and safe areas. Headless Chrome has neither.
- **Verify:** ran in full; all six steps PASS (client: 23 files, 160 tests).

## Result

- **Prepared:** branch `fix/sign-in-tablet-phone-layout`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from the full run on this branch, fix/sign-in-tablet-phone-layout @ affb08e)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Check (headless Chrome over CDP, real time, against `vite preview`):** see Build notes.
  - **Card start:** 255 px at 390×844 (was 541), 219 px at 844×390 (was 789) and 385 px at 820×1180 (was 789).
  - **Bar height:** 133 px on the phone and 64 px at 1600×700.
  - **Contrast:** the lowest text contrast is 4.86:1.
  - **Keyboard and motion:** card controls stay above the sticky bar during a Tab walk. The shapes pause off screen and with reduced motion.
- **Audit:** not needed (layout and decoration only).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none.
