---
name: brief
description: Read-only briefing on an upcoming build-plan item - what it delivers, what code it touches, what it depends on, open decisions, and rough size - before writing its spec. Use for /brief <id>.
---

# brief - explain a build-plan item before speccing it

Read-only. Writes nothing. Use `/feature` to write the actual spec.

## Gather

- The item's line in `blueprint/build-plan.md`, its phase, and any Decision it needs.
- The parts of `blueprint/project-plan.md` it relates to.
- Earlier history files it builds on.
- A quick look at the code it would touch (entities, controllers, components, tests).

## Report

- **What it delivers:** in plain words, for a user of VetiFlow.
- **What it touches:** the main files and areas, server and client.
- **Depends on:** earlier items that must be merged first, and whether they are.
- **Decisions needed:** anything open in the build plan's Decisions section or
  that the code makes unclear.
- **Risks:** security, data migration, breaking the client contract.
- **Size:** small (one step, under 150 lines), medium (2 to 4 steps), or large
  (should be split; suggest the split).
- **Next:** `/feature <id>`, or the decision to make first.
