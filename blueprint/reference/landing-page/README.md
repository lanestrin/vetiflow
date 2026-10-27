# VetiFlow — full-background edition

A responsive, dependency-free VetiFlow ER veterinary sign-in page built in editable HTML, CSS, and JavaScript.

## What's changed

- **One continuous, full-width background artwork** under the desktop layout, instead of image slices or a separate `<picture>` panel.
- Background art is in `assets/vetiflow-background-clean.webp`, with a JPEG fallback file included. The dog, cat, organic shapes, and ambient clinic setting are part of this single image.
- All headings, benefit descriptions, branding, login fields, help links, and emergency actions are **real accessible HTML** above the artwork; the image contains no baked-in interface text.
- A standard SVG paw print replaces the custom shield logo.
- At tablet and mobile widths, the **same image** is reused as a hero background, while sign-in and emergency controls are given separate readable space.
- Uses the Calm & Critical Care palette: navy `#1A2E40`, sage `#EAF2EE`, charcoal `#2B303A`, and emergency crimson `#D9383A`.

## Files

- `index.html` — semantic, accessible markup.
- `styles.css` — entire desktop/mobile design; adjust `.page-art` to change how the full background is positioned.
- `app.js` — email/phone tabs, password reveal, basic validation, configurable sign-in and emergency actions.
- `site-config.js` — configure actual hospital links and sign-in endpoint.
- `assets/vetiflow-background-clean.webp` — **main complete background** (preferred).
- `assets/vetiflow-background-clean.jpg` — JPEG version for CMS or fallback use.
- `assets/paw.svg` — standard paw print icon / favicon.
- `desktop-preview.png`, `mobile-preview.png` — rendered examples.

## Preview locally

You can open `index.html` in a browser. For more reliable local testing, run:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Required before production

1. Enter the **actual hospital emergency phone** and maps/directions URL in `site-config.js`. If unset, buttons show a preview-mode message instead of dialing made-up contacts.
2. Enter the real help and password-reset URLs.
3. Implement an actual **server-side sign-in** backend and set `signInEndpoint`. It should establish a secure HttpOnly session cookie and return `{ "success": true }` on a valid login. The included front-end is **not** an authentication backend.
4. Remove sample demo credentials and the proof-of-concept notice for a live clinic.
5. If you prefer JPEG instead of WebP, change the single `.page-art`/mobile `.hero` `background` URLs in `styles.css` to the included JPG.

**Do not publish the emergency actions without configuring a real clinic number and address.**
