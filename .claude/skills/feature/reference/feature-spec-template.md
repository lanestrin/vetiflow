# Feature: <title>

**From build-plan:** feature <id>
**Status:** not started
**Branch:** `<branch from the build plan>`

## Goal

What this item delivers and why it matters, in one or two sentences.

## Design reference

Only for UI that recreates a design: link the image in `blueprint/reference/`.
Delete this section otherwise.

## In scope

- What this branch includes.

## Out of scope

- What it leaves for later, with the build-plan ID when there is one.

## Build steps

`/implement` ticks each step when its check passes. A fresh session resumes at
the first unticked step.

- [ ] **Step 1 - <name>** - what gets built. *Done when:* <observable result and the check that shows it>.
- [ ] **Step 2 - <name>** - what gets built. *Done when:* <observable result and the check that shows it>.

## Files / areas

- Files and folders this creates or changes.

## Data / contracts

- Entities, columns, indexes, migrations, enum values.
- Endpoint routes, request and response shapes, status codes.
- Hub messages.
- Or "none".

## Security

- Who may call each new endpoint or hub method.
- What owners can and cannot reach.
- What must never be logged or returned.
- Or "no new surface".

## Testing

- Server: <test class and method names>, and which need real Postgres.
- Client: <test file names>.
- `/check`: what to observe in the running app.

## Notes for the AI

- Constraints and conventions that matter here.

## Open questions

- Only when a product decision is still open. Delete otherwise.
