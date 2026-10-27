# Feature: Living shapes on the sign-in landing page

**From build-plan:** feature S.20c
**Status:** complete
**Branch:** `feature/landing-living-shapes`
**Audit:** not needed - decorative motion on an existing page; no endpoint, data or sign-in change

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## Goal

The green shapes on `/sign-in` move slowly and fluidly, as in the designer's
reference: the dog-and-cat photo sits in a blob whose edge breathes, with a
mint halo behind it that breathes on its own timing. The other green shapes
and the dots move gently too. Nothing else on the page moves, and people who
ask their system for reduced motion see it still.

## Design reference

- **The motion:** codepen.io/supah/pen/PoZrzQx ("SupahBlob" by Fabio
  Ottaviani). The code was pasted in chat on 2026-10-27, and an 8-second
  screen recording of the pen was reviewed, then deleted. It showed a
  portrait photo in a breathing blob with a pale-green halo whose edge drifts
  apart from the photo's and back. It works like this:
  - A blob is a closed smooth curve through 9 points spaced evenly around a
    centre.
  - Each point moves in and out between a minimum and maximum radius on a
    sine ease, back and forth forever, each with its own random duration (1â€“3 s
    for the photo, 2â€“3 s for the halo).
  - The photo is clipped to one blob, and a pale-green halo blob slightly
    larger sits behind it.
- **The page:** the S.20a layout as merged
  (`blueprint/history/features/S.20a-landing-sign-in-layout.md`) and
  `blueprint/reference/landing-page/desktop-preview.png`. The shapes marked
  in chat on 2026-10-27:
  - the mint blob at the top
  - the mint blob at the bottom left
  - the mint shape behind the card's lower edge, with its three dots
  - the edge where the photo meets the cream
- **The photo:** "Cozy Shiba Inu and Tabby Cuddle.png" (1672Ã—940, no baked-in
  shapes), from the person's Downloads, converted to WebP for the app.

## In scope

- **New art set** in `src/assets/sign-in/`:
  - `photo.webp`, the shape-free photo (about 1672 px wide). It replaces
    `background-1x.webp` and `background-2x.webp`, whose baked-in shapes
    can't move.
  - The cream, the mint shapes and the dots are drawn in the page as SVG, so
    nothing green is in an image any more.
- **`LivingBlob`** (an SVG `path`): a closed curve through N points, each
  moving between a min and max radius as in the reference. Its settings are
  the number of points, centre, min and max radius, min and max duration, and
  fill.
  - Driven by one `requestAnimationFrame` loop per scene, not GSAP: the
    reference's GSAP use is a sine back-and-forth per point, which is a few
    lines of maths. No new package.
  - The curve maths (points to a smooth closed path) is a pure function,
    ported from the reference's `createPath`.
- **`SignInScene`** replaces the `.art` background layer, `aria-hidden` as
  before. One SVG holds:
  - the halo blob (mint, behind)
  - the photo, clipped to the photo blob through an SVG `clipPath` with the
    photo as an SVG `<image>`. This avoids the reference's forced clip-path
    refresh.
  - the top mint blob, the bottom-left mint blob, and the mint blob behind
    the card's lower edge
  - three dots drifting a few pixels on slow loops
- **Desktop (85rem and up):**
  - The scene fills the page behind the content.
  - The photo blob is centred in the gap between the story and the card,
    sized so the dog's and cat's faces stay inside it and clear of the card.
  - The shapes sit where they are in the design.
- **Narrow screens:** the hero band shows the photo blob and its halo, with
  the dots. The other mint shapes are hidden there.
- **Motion rules:**
  - Slow and gentle: each point travels a short distance on a 2â€“6 s cycle,
    slower than the reference, because this is a sign-in page, not a
    showcase.
  - Only the shapes move. The photo's content, the text and the card stay
    still.
  - `prefers-reduced-motion: reduce` means no animation loop at all; the
    shapes are drawn once at their middle radius. This is checked at mount
    and when the setting changes.
  - The loop stops while the tab is hidden, and when the page unmounts.
- **Added with the person's OK on 2026-10-27:**
  - **The new logo:** `blueprint/reference/vetiflow_icon.svg`, an asterisk
    with a heartbeat line. It replaces the paw beside "VetiFlow",
    recoloured from the designer's `#F20D1B` to the landing design's crimson
    `#D9383A` (chosen from six colour options).
  - **The favicon, app-wide:** the same crimson asterisk without the
    heartbeat line, which can't be seen at 16 px. It replaces the teal plus.
  - **A sharper photo:** the designer's 3344×1880 export. `photo-1x.webp`
    and `photo-2x.webp` are both made from it, and high-density screens get
    the 2x.

## Out of scope

- Any motion other than the shapes: no parallax, no hover effects, no entry
  animation of the card or text.
- The emergency bar (S.20b).

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [x] **Step 1 - blob maths and `LivingBlob`** - the pure path function, the
  per-point radius over time, and the component with its reduced-motion
  rule. *Done when:*
  - `livingBlob.test.ts` (new) checks:
    - the path starts with `M`, has one curve segment per point, and ends
      with `z`
    - every point stays between its min and max radius at any time
    - with reduced motion, the radius is the middle value and doesn't change
      over time
  - `LivingBlob.test.tsx` (new): with reduced motion, no animation frame is
    requested; without it, one is, and it is cancelled on unmount.
- [x] **Step 2 - the scene on the page** - convert the photo, add
  `SignInScene`, place it for desktop and narrow screens, and remove the old
  background WebPs. *Done when:*
  - `SignInPage.test.tsx` still finds no announced image, and every sign-in
    test passes.
  - Client lint, build and all tests pass.
  - Screenshots at the S.20a widths show the photo blob clear of the card
    and nothing scrolling sideways at 320 px. Two frames a second apart show
    the shapes have moved and the text hasn't.

## Files / areas

- `vetiflow.client/src/assets/sign-in/photo.webp` (new);
  `background-1x.webp` and `background-2x.webp` removed
- `vetiflow.client/src/components/auth/livingBlob.ts` and its test (new):
  the maths
- `vetiflow.client/src/components/auth/LivingBlob.tsx` and its test (new)
- `vetiflow.client/src/components/auth/SignInScene.tsx` and its module (new)
- `vetiflow.client/src/routes/SignInPage.tsx` and `SignInPage.module.scss`
  (`.art` becomes the scene)

## Data / contracts

- None.

## Security

- No new surface. No new package, no external script or image.

## Testing

- Client: `livingBlob.test.ts`, `LivingBlob.test.tsx` (new), and
  `SignInPage.test.tsx` unchanged.
- The motion itself is checked in the browser, not unit tested.
- `/check`:
  - Screenshots at 2560, 1920, 1600, 1440, 1366, 1024, 768, 390 and 320 px.
  - A second screenshot a moment later to show movement.
  - The browser steps are yours if no browser tool is available:
    - watch it for a minute for smoothness
    - turn on "reduce motion" in Windows (Settings, Accessibility, Visual
      effects, Animation effects off) and reload: everything stands still
  - CPU in the browser's performance panel stays low; the tab in the
    background stops the loop.

## Notes for the AI

- One `requestAnimationFrame` loop updates every blob's `d` attribute
  directly through refs, not React state, so React doesn't re-render 60 times
  a second.
- Use a seeded random for each blob's per-point durations and phases, so
  tests and screenshots are repeatable.
- Keep the SVG `viewBox` in fixed units and position the scene with CSS, as
  `.art` is today, so the S.20a layout maths still holds.
- The mint colours are the ones sampled from the art in S.20a (`#DEEFE3`,
  `#D3EADD`) and the halo `#E3EFE8`.

## Build notes

- **No separate `LivingBlob` component:** the blobs are plain SVG paths in
  `SignInScene.tsx`, written through refs by one loop. The reusable parts are
  `livingBlob.ts` (the maths) and two hooks:
  - `useAnimationLoop.ts`: one `requestAnimationFrame` loop that pauses while
    the tab is hidden and stops on unmount.
  - `useMediaQuery.ts`: reduced motion and narrow screens.
- **Tests:** `useAnimationLoop.test.tsx` replaces the planned
  `LivingBlob.test.tsx` and checks the same things: no frames when still,
  seconds since start, and cancelled on unmount.
- **Two layouts in one scene:**
  - **Wide:** the S.20a 1672×840 box, still placed by `.art`. The photo is in
    a self-contained blob between the story and the card, at about the S.20a
    animal size.
  - **Narrow:** a 1000×460 band with a round photo blob centred, as in the
    reference. The band is a little taller than before (14–26rem, 60vw).
- **Unlike S.20a, the photo no longer runs behind the card to the right
  edge.** The pen's look is a contained blob, and covering the whole width
  would have drawn the animals about 25% larger and pushed the dog under the
  card.
- **The dots** sit on the mint shape at the photo's lower right, clear of the
  card.
- **Photos:** `photo-1x.webp` (1672×940, 99 KB) and `photo-2x.webp`
  (3344×1880, 205 KB), both made from the designer's 3344×1880 PNG with
  headless Chrome's canvas encoder. An SVG `<image>` has no `srcset`, so
  `SignInScene` picks one with `(min-resolution: 1.5dppx)`. A 2x screenshot
  confirmed the page loads `photo-2x`.
- **Logo and favicon:** `src/assets/sign-in/logo.svg` replaces `paw.svg`,
  and `public/favicon.svg` is the asterisk alone. It was checked at 16, 32
  and 64 px on light and dark backgrounds. The tokens comment no longer
  calls the favicon teal.
- **Screenshots:** headless Chrome against `vite preview` at 2560×1080,
  1920×1080, 1600×900, 1366×768, 1024×768, and 390 and 320 px through an
  iframe. The layout checks passed.
  - Headless Chrome's clock barely advances animation frames, so two
    screenshots can't show the motion. The page's blob paths did change
    between moments (read from the live page), and the motion maths is unit
    tested.
  - Watching the motion live, and the reduced-motion setting, are left for
    the person.

## Result

- **Prepared:** branch `feature/landing-living-shapes`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (ran)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:**
  - Step 1: `livingBlob` and `useAnimationLoop` tests, 9/9.
  - Step 2: client 136/136, with lint, types and build clean.
- **Check (headless Chrome against `vite preview`):**
  - Layout screenshots at 2560×1080, 1920×1080, 1600×900 (1x and 2x), 1366×768 and 1024×768, plus 390 and 320 px through an iframe.
  - The first composition drew the photo across the full width, which made the animals too large and put the dog under the card. The photo blob was then made self-contained and resized.
  - The page served the 2x photo at 2x density, and the favicon was checked at 16, 32 and 64 px.
  - The motion itself couldn't be captured, because headless Chrome barely advances animation frames. The blob paths were read changing in the live page.
  - Watching the motion live and the reduced-motion setting are left for the person.
- **Audit:** not needed (decorative motion; no endpoint, data or sign-in change).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none (no migration or setting). The new favicon shows on every page.
