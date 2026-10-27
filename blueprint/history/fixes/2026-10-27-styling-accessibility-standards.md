# Fix: Styling and accessibility standards

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/styling-accessibility-standards`
- **Audit:** not needed - workflow docs only (`coding-standards.md`, `project-plan.md`); no application code, config or data

## The problem

The standards say little about styling and accessibility: two lines under
Styling in `blueprint/context/coding-standards.md` ("SCSS modules per
component...", "No inline styles. AA contrast. Visible focus states.") and one
line in project plan section 7 ("Accessible: keyboard alternative to drag and
drop, `aria-live` for remote changes, AA contrast"). The screens coming next
(the sign-in screen S.18, the case drawer 3.2, the intake form 4.1b) need
clear rules for responsive layout, colour-independent cues, focus, zoom and
what `/check` observes, before they are built.

You wrote the fuller text during 2.3. It was stashed so it would not mix into
that branch, and is now back as uncommitted changes on `main`.

## The fix

Land your text unchanged on its own branch:

- **`coding-standards.md`, Styling:** co-located `.module.scss`, globals once
  through `globals.scss`, tokens for real shared decisions, components before
  mixins, `@use` not `@import`, simple selectors without `!important`, named
  variants, Grid or Flexbox before fixed sizes, and `rem`, unitless line
  heights and logical properties. Screenshots guide appearance; responsive
  and accessibility rules still apply.
- **New "Responsive and accessible design":** WCAG 2.2 AA; layouts from
  320 CSS px, phone, tablet and desktop; 200% text and 400% zoom reflow; a
  visible non-colour cue for acuity, timers, task status and validation;
  contrast ratios; semantic HTML and labelled controls; keyboard access and
  visible focus; touch targets and reduced motion; and what `/check`
  observes for changed UI. No audit or self-review stage by default.
- References to Vite CSS Modules, Sass `@use` and WCAG 2.2.
- **`project-plan.md` section 7:** the "Accessible" line becomes "Responsive
  and accessible", pointing at the new section.

Checked against the repository: there are no em or en dashes (the Writing
rule). The client already follows it (no `@import`, no `!important`; the
only fixed pixel values are pill radii and the 320 px minimum width in
`_reset.scss`). It agrees with the audit-on-request workflow. Existing screens
are brought in line as they change (2.10, 2.11, 7.6), not by this fix.

Must not change: anything else in either file, application code, other
workflow files.

## Build steps

- [x] **Step 1 - land the standards** - on the branch, the two files carry
  your text exactly as written. *Done when:* `git diff main` shows only your
  changes to those two files, with no em or en dashes, and the project plan
  line points at the coding-standards section by its exact heading.

## Verify

- `scripts/verify.ps1 -ReuseIfCurrent` passes (docs only).
- Nothing to observe in the app; `/check` is skipped.

## Result

- **Prepared:** branch `fix/styling-accessibility-standards`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-10-27 (reused from 2026-10-27T00:23:16Z, fix/styling-accessibility-standards @ 6a751e3)
  - PASS  Workflow tests
  - PASS  Server build
  - PASS  Server tests
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests
- **Narrow check:** the diff against `main` holds only the person's changes to `coding-standards.md` and `project-plan.md`; no em or en dashes; the project plan names the exact heading "Responsive and accessible design".
- **Check:** not run - docs only
- **Audit:** not needed
- **Follow-ups added to build plan:** none
- **Deploy notes:** none
