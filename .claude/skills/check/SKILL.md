---
name: check
description: Prove the current spec's Done when items against the running VetiFlow API and client, with observed evidence and no source edits. Use /check to verify real behaviour, or /check guide for a short manual Try it now walkthrough for the person.
disable-model-invocation: true
---

# check - prove it works in the running app

A green build is not proof of behaviour. This skill observes the real app.
It never edits source files.

## Pick the mode first

- `/check` or `/check <step>`: verification mode, below.
- `/check guide`, or "how do I test this myself": guide mode, at the end. Guide
  mode runs nothing and records nothing.

## Verification mode

### 1. Read the target

Read `blueprint/context/current-feature.md`. List the *Done when* items that
need the running app (an endpoint response, a board update, a screen state).
Items fully covered by automated tests are already proven by `/verify`; say so
and skip them.

### 2. Start the app

Ask the person to start it if it is not running, or start it yourself when the
environment allows:

```bash
powershell -ExecutionPolicy Bypass -File scripts/db-target.ps1 -StartApp
cd vetiflow.client && npm run dev
```

`-StartApp` starts the API only when its database is local, bound to the
connection string it checked (the app migrates on startup). If it prints
anything other than `Database target: local`, nothing started: stop and report.
Never start the API with `dotnet run` directly, and never list or print the
connection string.

### 3. Observe each item

- **API:** call the endpoint (`curl`, or the requests in
  `vetiflow.Server/vetiflow.Server.http`). Record method, URL, status code and
  the relevant part of the body. Include the denied and invalid cases from the
  spec (400, 401, 403, 404, 409).
- **Live updates:** open the board in two browser tabs, change a case in one,
  and confirm the other updates.
- **UI:** load the page, perform the action, take a screenshot when a browser
  tool is available. Compare with `blueprint/reference/` for design work.
- **Browser tests:** when Playwright is set up (`/tests browser`), run the
  relevant spec as well.

### 4. Report

A table: *Done when* item, what was done, what was observed, PASS or FAIL.
State plainly anything you could not observe and why. Do not mark the spec
`verified` from here; `/implement` owns status.

Then end ("Ending a turn" in `blueprint/context/ai-interaction.md`). Inside
`/ready`, a FAIL is repaired without asking and this section does not apply.

- **All PASS:** `Status: App check passed; ready to archive and prepare
  publication.` `Next: /complete`
- **A FAIL:** `Status: Blocked - <Done when> failed in the running app.`
  `Next: /ready` (it repairs in scope and checks again). When the cause is
  unclear, `Next: /debug` instead. When the spec itself was wrong, propose the
  corrected *Done when* and ask for an OK.
- **Could not observe an item:** `Status: Blocked - could not observe <item>
  (<what is missing>).` `Next:` how to provide it, then `/check` (or
  `/check guide` to try it yourself).

## Guide mode

Write a short `## Try it now` for the person:

1. How to start the app (the two commands above).
2. Where to go (URL or Visual Studio `.http` request).
3. Exactly what to click or send.
4. What they should see, and what a wrong result would look like.

Keep it to the smallest path that shows the change. If nothing user-visible
changed (pure refactor or config), say there is no meaningful manual check.
