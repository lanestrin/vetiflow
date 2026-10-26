---
name: debug
description: Reproduce and isolate a VetiFlow failure (failing test, API error, board not updating, migration problem) without editing source, then hand the evidence to /fix or /implement. Use for /debug or when the cause of a problem is unclear.
disable-model-invocation: true
---

# debug - find the cause, change nothing

This skill reads, runs and observes. It never edits source, tests or
migrations. Temporary scratch files go outside the repo and are deleted.

## 1. Pin down the symptom

Write down in one line each: what was expected, what happened, where (test
name, endpoint, screen), and when it started if known (`git log` on the files).

## 2. Reproduce

Pick the smallest reproduction:

- A failing test: run just that test (`/test <filter>`) and capture the full
  message and stack.
- An API error: one request against the local app, with status and body. Check
  the server console for the exception.
- The board not updating: two tabs, the browser console, the SignalR connection
  state, and the hub message (or its absence).
- A migration or database error: `dotnet ef migrations list`,
  `has-pending-model-changes` (after `dotnet tool restore`, which installs the
  pinned `dotnet-ef`), and the exact SQL error. Local database only.
- A client error: the browser console and network tab, or the failing Vitest output.

If it does not reproduce, say so and list what was tried.

## 3. Narrow it

- Read the code path from the entry point to the failure.
- Form one hypothesis at a time and test it with an observation (a log line you
  read, a query you run, a request you vary). No speculative edits.
- `git diff main...` and `git log -p` on suspect files often show the change that
  broke it.
- Stop after 2 or 3 hypotheses that do not hold, and report what is known.

## 4. Hand over

- **Cause:** the file and line, and why it fails.
- **Evidence:** the commands and their output.
- **Suggested fix:** the smallest root-cause repair, and the test that would
  have caught it.
- End with the handoff ("Ending a turn" in `blueprint/context/ai-interaction.md`):
  `Status: Cause found` (or `Blocked - cause not found`). `Next: /fix "<title>"`
  between work items, or, when it belongs to the active work, reply "add a
  repair step" (a spec change for your OK, then `/ready`).
