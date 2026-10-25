---
name: migration
description: Add and review an EF Core migration for a VetiFlow model change - generate it, check Up and Down, add data updates for enum renames, apply it to the local database only, add a migration test, and confirm no pending model changes. Use for /migration <Name> or any model change.
disable-model-invocation: true
---

# migration - change the data model safely

Every model change ships its migration in the same branch. This skill never
touches a hosted database.

## 1. Before generating

- The model change (entity, `OnModelCreating`) is done and builds.
- `dotnet ef migrations has-pending-model-changes --project vetiflow.Server`
  reports a change. If it reports none, there is nothing to migrate.
- No migration that is already on `main` gets edited. Always add a new one.

## 2. Generate

```bash
dotnet ef migrations add <PascalCaseName> --project vetiflow.Server
```

Name it for what it does: `AddOwner`, `RenameStableAcuityToHigh`.

## 3. Review the generated code

Show the person the `Up` and `Down` methods and check:

- **Enum renames:** EF sees no schema change because enums are text. Add
  `migrationBuilder.Sql("UPDATE ... SET \"Acuity\" = 'High' WHERE \"Acuity\" = 'Stable'")`
  for every column that stores the enum, in `Up`, and the reverse in `Down`.
- **Dropped or renamed columns:** EF may drop and re-add, losing data. Use
  `RenameColumn` instead, or copy data first.
- **New required columns on existing tables:** a default or a data backfill.
- **Foreign keys:** `ReferentialAction.Restrict`, never cascade.
- **Indexes:** partial unique indexes keep their `filter:` (`"DischargedAt" IS NULL`).
- **Down:** actually reverses `Up`.

## 4. Apply locally

1. Show the connection string target from
   `dotnet user-secrets list --project vetiflow.Server` or
   `appsettings.Development.json`, without printing passwords. It must be
   `localhost` or a local Docker container. If it points anywhere else, stop.
2. `dotnet ef database update --project vetiflow.Server`.
3. Spot-check with `psql` or the app that existing rows look right.

## 5. Test

- `vetiflow.Server.Tests/Data/MigrationTests.cs` already checks the model
  matches the snapshot and that up/down/up works. Run it.
- For a data migration (like an enum rename), add a test that seeds rows in the
  old shape, migrates, and asserts the new values.
- `has-pending-model-changes` must now report none.

## 6. Report

The migration name and files, what `Up` does in plain words, data updates
added, test results, and a deploy note: on Render, migrations run only when the
deploy step or `Database__MigrateOnStartup` runs them (build plan S.1).
