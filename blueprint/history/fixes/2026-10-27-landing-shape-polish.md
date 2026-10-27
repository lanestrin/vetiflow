# Fix: Sign-in shapes cut off and a small phone photo

**Type:** Fix
**Status:** complete
**Branch:** `fix/landing-shape-polish`
**Audit:** not needed - decorative layout on the sign-in page; no data, endpoint or sign-in change

<!-- Status: not started -> approved (the person's OK) -> in progress -> verified.
Audit: a recommendation only; see "When to recommend an audit" in
blueprint/context/ai-interaction.md. -->

## The problem

Reported with screenshots on 2026-10-27, after S.20c
(`blueprint/history/features/S.20c-landing-living-shapes.md`):

1. **The bottom-left mint bubble is cut off with a hard vertical edge.**
   - On wide screens the art box (`.art` in
     `vetiflow.client/src/routes/SignInPage.module.scss`) is shifted so its
     30% line meets the story column. Its left edge is then often inside the
     page, not at it.
   - `SignInScene` clips everything to that box (`overflow: hidden` in
     `SignInScene.module.scss`).
   - So the bottom-left blob, centred at x = 80 with a radius up to 180, loses
     its left part.
   - Reproduce: open `/sign-in` at 1920×1080 or wider and look at the bottom
     left, under "THOUGHTFUL CARE. CLEAR COMMUNICATION."
2. **On phones the photo is too small.**
   - The hero band's photo blob is round and sits in a 1000×460 frame scaled
     to fit, so on a 390 px phone it is only about 160 px across.
   - The person asked for a more horizontal shape that belongs with the
     site's wide mint shapes.

## The fix

1. **Let the wide scene spill to the left, not down.**
   - The SVG may draw outside its box.
   - `.art` clips only at its top, right and bottom
     (`clip-path: inset(0 0 0 -100vw)`), so shapes reach the page's left
     edge.
   - The bottom stays clipped where the art fades into the page.
   - Nothing else moves: the box placement maths from S.20a stays as it is.
2. **A wide, organic photo blob on narrow screens.**
   - `BlobSettings` gains an optional horizontal and vertical stretch
     (default 1, so the wide layout's shapes don't change).
   - The band layout uses a 1000×620 frame (closer to a phone band's shape)
     with the photo blob stretched to about 1.7 times as wide as tall. It
     fills most of the band width, so on a 390 px phone it is about 350×200
     px instead of 160×160.
   - The halo stretches with it. The dots move to its lower right, and the
     photo is re-placed so both animals stay inside the shape.
   - Motion, reduced motion and the 1x/2x photo choice stay as they are.

Must not break: the S.20a/S.20c desktop layout, sign-in, no sideways scroll
at 320 px, and the tests that nothing decorative is announced.

## Build steps

- [x] **Step 1 - stretch in the blob maths** - optional `stretchX` and
  `stretchY` in `livingBlob.ts`. *Done when:* `livingBlob.test.ts` adds
  "stretches the shape": a 2× horizontal stretch doubles every point's
  distance from the centre across, and leaves the vertical distance as is.
- [x] **Step 2 - layout** - the left spill for the wide scene, and the new
  band layout. *Done when:*
  - Client tests, lint and build pass.
  - Screenshots show:
    - at 1920 and 2560 px, the bottom-left bubble with a round left side
    - at 390 and 320 px, the wide photo blob filling most of the band with
      both animals whole
    - no sideways scroll

## Verify

- Client: `livingBlob.test.ts` and all existing tests.
- In the app: `/sign-in` at 2560, 1920, 1600, 1366, 1024, 768, 390 and 320
  px.

## Build notes

- **The fade now spills left too:** besides the clip, the art's foot fade
  (`.art::after`) reaches 100vw to the left. Without it, the part of the
  bubble left of the box would skip the fade and show a seam.
- **Band layout:** frame 1000×620. The photo blob's radius eases between 258
  and 276 units, stretched 1.68 times across. The photo is drawn at
  1366×768 units, centred on the animals.
- **Test:** `livingBlob.test.ts` adds "stretches the shape". It compares x
  and y separately, so no `expect` sits in a condition (lint rule).
- **Screenshots:** headless Chrome against `vite preview` at 2560×1080,
  1920×1080, 1600×900 and 768×1024, plus 430, 390 and 320 px through an
  iframe.
  - At 1920 and 2560 px the bottom-left bubble is round, with no hard edge.
  - At 390 px the photo oval is about 350 px wide, with both animals whole.
  - Nothing scrolls sideways at 320 px.

## Result

- **Prepared:** branch `fix/landing-shape-polish`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T17:33:22Z, fix/landing-shape-polish @ 2123105)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow checks:**
  - Step 1: `livingBlob` tests 7/7.
  - Step 2: client 137/137, with lint and build clean. The first lint run flagged `expect` inside a condition in the new test; it was rewritten.
- **Check (headless Chrome against `vite preview`):**
  - At 2560×1080 and 1920×1080 the bottom-left bubble is round, with no hard edge.
  - At 1600×900 the desktop is unchanged.
  - At 768×1024 the wide oval spans most of the screen.
  - At 430, 390 and 320 px the oval fills the band (about 350×200 px at 390), with both animals whole and no sideways scroll.
- **Audit:** not needed (decorative layout).
- **Deploy notes:** none.
