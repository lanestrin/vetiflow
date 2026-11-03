# Fix: Remove security work from the build plan (demo only)

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/remove-security-from-plan`
- **Audit:** not needed - planning docs only; no application code, auth or data changes. Existing protections in the app stay as they are.

## The problem

The person decided on 2026-11-03 that VetiFlow is a demo and security work is not required at this time: "remove everything related to security off of the build plan". `blueprint/build-plan.md` still plans 22 security, privacy and audit items, and many Decisions and open items depend on them.

**Items the person chose to remove:**

| Group | Items |
| --- | --- |
| M3 Security Lab | S.21a-e |
| M3 identity and authorization | S.5 (staff login), S.15 (staff accounts), S.6 (role permissions), S.7 (hub sign-in), S.14 (session timeout), S.9 (rate limiting) |
| Owner access | S.8 (owner access control) |
| Database login | S.10c (app-role cut-over) |
| Security hardening | 8.2 (security headers), 8.7 (security scanning), 8.8 (security review) |
| Role-safe overview | 3.7a, 3.7b |
| Chosen as borderline | 8.4 (AI data safety), 8.5 (privacy and data handling), 8.1 (audit log), 9.1 (staff admin) |

**Places that refer to them:**
- **Decisions:** "Security Lab boundary" (before S.21a), "Login provider" (before S.5), "Owner access" (before S.8), "Clinical/reception visibility" (before S.6 and 3.7a), and the S.6/3.7b note in the Demo role switch decision (line 90).
- **"Until S.6" interim policies:** in "Build the simplest working version first", "Patient Overview quick edits" and "Next care action and task priority".
- **Section intros:** M2's intro (line 343), M3 with its Security Lab text, M3b's (lines 422-425), M3b's "Permission-filtered shared overview (requires S.6)" label (line 441), the discharge note (line 486), and the launch-gate note (line 543).
- **Open items with a removed prerequisite:** 2.22a, 4.15c, 4.19c, 6.5a, 6.5b, 6.6, 6.2a and 6.3.

## The fix

- **Record the decision.** Add to Decisions: "**Demo only, no security work** (decided 2026-11-03, by the person): VetiFlow is a demo with fictional data. Security, privacy and audit items are removed from the plan; the existing sign-in demo, the team-member and pet-parent policies and the CLAUDE.md hard rules stay as they are. The app must not hold real clinic data unless this decision is revisited."
- **Drop the 22 items.** Delete their lines and list them in Dropped, as one bullet with the IDs and the reason "dropped 2026-11-03, by the person: demo only; security, privacy and audit work is not required (see Decisions)". Their IDs are never reused.
- **Remove the sections and labels that empty out:** the whole M3 section with its Security Lab intro, the "Permission-filtered shared overview" label, and any other group label left with no items.
- **Decisions:**
  - Remove the Security Lab boundary and Login provider decisions.
  - Reword "Owner access" to "before 6.3", since 6.3 (owner page) stays.
  - Reword "Clinical/reception visibility" to keep only the client-wording and escalation approval question, "before 6.5a".
- **Make the interim policies the demo's rule:** "until S.6 every signed-in team member may edit" becomes "every signed-in team member may edit (demo)", and the same for the "S.6 restricts…" sentences. Every rewording keeps each decision's clinical rules.
- **Open items:**
  - Remove S.5, S.6, S.7, S.8, 3.7 and 8.1 from their "after …" prerequisites, keeping the other prerequisites and wording.
  - M3b's intro and the launch-gate note drop their S.5/S.6/S.7 sentences.
  - "Role-authorized" or "permitted" wording stays where it describes clinical behaviour, not a removed item.
- **Other docs that name a removed ID as planned work:** `blueprint/project-plan.md` (for example "Staff sign-in and roles before any real clinic data"), `blueprint/context/coding-standards.md`, `blueprint/reference/er-board-poc/README.md`, `blueprint/reference/security-poc/README.md`, `blueprint/reference/README.md` and the `/audit` skill's endpoint check (`.claude/skills/audit/SKILL.md`, added while building). Each gets the demo-only wording or the dropped status. History files are not edited.
- **Unchanged:** every other open item and its order; application code; CLAUDE.md hard rules; tests.

## Build steps

- [x] **Step 1 - remove the security items and their references** - the edits above. *Done when:*
  - each of the 22 IDs appears in `build-plan.md` only in the Dropped bullet;
  - outside `blueprint/history/`, no doc names them as planned or pending work;
  - the new Decision is present;
  - 86 open items remain (108 minus 22), the others unchanged and in the same order apart from the reworded prerequisites;
  - no empty group label or section is left;
  - `git diff --check` is clean.

## Verify

- `scripts/verify.ps1` (workflow scope: docs only).
- No `/check`: nothing changes in the app.

## Result

- **Prepared:** branch `fix/remove-security-from-plan`, verified and awaiting publication.
- **Verify:** `scripts/verify.ps1` on 2026-11-03, scope workflow (reused from 2026-11-03T21:43:49Z, fix/remove-security-from-plan @ e80db9a)
  - PASS  Workflow tests
  - Not needed: server steps (no server files changed)
  - Not needed: client steps (no client files changed)
- **Check:** not run; nothing changes in the app. Instead, compared with `main`: 108 open items became 86, the others identical in order; none of the 22 dropped IDs is open; they appear in `build-plan.md` only in the Dropped bullet and the new decision; the M3 section and the empty "Permission-filtered shared overview" label are gone; no doubled blank lines; outside `blueprint/history/` and the git-ignored `.verify/` snapshots, no doc names a dropped item as planned work (the security-poc README keeps its own mapping table under a "reference only" note); `git diff --check` is clean. The first open item is 2.16a.
- **Corrected while building:** the spec's count was 22 items, not 23 (13 S items, not 14), so 86 open items remain, not 85; the `/audit` skill's endpoint check also named S.5 and was updated.
- **Left in on purpose:** 8.3 (log redaction, which mirrors a CLAUDE.md hard rule) and 8.13 (revoke the app role's `DELETE`) are security-adjacent but were not in the person's chosen set.
- **Audit:** not needed (planning docs only).
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none
