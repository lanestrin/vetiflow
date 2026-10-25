---
name: add-tests
description: Write tests for existing VetiFlow code that has none or too few - a domain method, endpoint, database rule, service or component - characterising current behaviour and reporting suspected bugs instead of silently fixing them. Use for /add-tests <target>.
disable-model-invocation: true
---

# add-tests - cover existing code with tests

Adds tests only. Product code does not change. If a test shows a likely bug,
report it; the repair goes through `/fix`.

## Input

A target: a class or method (`EmergencyCase.RecordTriage`), an endpoint
(`PATCH /api/cases/{id}/stage`), a database rule (one active case per room), a
client service (`casesApi`) or a component (`CaseCard`).

Run on its own `test/<target>-tests` branch, or as a step inside the current
spec when the person asks for it there.

## 1. Understand the target

- Read the code, its callers and any existing tests for it.
- List the behaviours: the happy path, edge cases (empty, null, boundary
  values), invalid input, denied access, and error paths.
- Read the Testing section of `coding-standards.md`.

## 2. Choose where each test goes

| Target | Location | Style |
| --- | --- | --- |
| Entity or pure logic | `vetiflow.Server.Tests/Unit/` | Plain xUnit, no database |
| Endpoint | `vetiflow.Server.Tests/Api/` | `VetiFlowApiFactory`, real HTTP calls, assert status and JSON shape |
| Index, constraint, enum storage, migration | `vetiflow.Server.Tests/Data/` | Real Postgres fixture |
| Hub broadcast | `vetiflow.Server.Tests/Api/` | SignalR client against the factory |
| Client service | next to the file, `*.test.ts` | MSW handlers |
| Component | next to the file, `*.test.tsx` | Testing Library, query by role and label |

Reuse `Infrastructure/TestData.cs` and `src/test/builders.ts`; extend them
rather than building data by hand.

## 3. Write the tests

- One behaviour per test, named `Method_Condition_Result`.
- Assert what a user or caller can observe, not private details.
- Characterise first: a test describes what the code does today. Where today's
  behaviour looks wrong, write the test for the **correct** behaviour, mark it
  clearly, and let it fail; do not change product code.

## 4. Run and report

- Run the new tests with `/test`, then `/verify`.
- Report: tests added (file and names), what they cover, and a list of
  **suspected bugs** (failing tests that describe correct behaviour) with the
  suggested `/fix` title for each.
- Before handing over, a failing suspected-bug test must not be left in the
  branch silently. Ask the person: keep it failing and open `/fix` next, or move
  it into the fix branch.
