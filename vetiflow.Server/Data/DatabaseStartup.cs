using Microsoft.EntityFrameworkCore;

namespace vetiflow.Server.Data;

// What startup may do to the database. Both settings are off unless set, so a
// production deploy never changes the schema or adds demo rows by accident.
// The production migration step is in blueprint/project-plan.md, section 8.
public static class DatabaseStartup
{
	// In production the app's own connection is the vetiflow_app role, which
	// can't change the schema, so migrations need the privileged
	// migrationConnectionString. Without one (local development, tests) the
	// app's connection migrates.
	public static async Task PrepareAsync(
		VetiFlowDbContext dbContext,
		bool migrateOnStartup,
		bool seedDemoData,
		ILogger logger,
		string? migrationConnectionString = null)
	{
		if (migrateOnStartup)
		{
			// Fails loudly on purpose: someone asked for this migration.
			await MigrateAsync(dbContext, migrationConnectionString);
		}
		else if (await dbContext.Database.CanConnectAsync())
		{
			var pending = (await dbContext.Database.GetPendingMigrationsAsync()).ToList();
			if (pending.Count > 0)
			{
				// Stopping here fails the deploy, so the previous build keeps
				// serving instead of new code running against an old schema.
				logger.LogCritical(
					"The database is missing migrations: {PendingMigrations}.",
					string.Join(", ", pending));
				throw new InvalidOperationException(
					$"The database is missing {pending.Count} migration(s). " +
					"Set Database__MigrateOnStartup=true and ConnectionStrings__VetiFlowMigrations " +
					"for this deploy, then remove both.");
			}
		}
		else
		{
			// Start anyway, so /api/health can report the outage.
			logger.LogWarning("The database is unreachable at startup; skipping the migration check.");
			return;
		}

		if (seedDemoData)
		{
			await DbSeeder.SeedAsync(dbContext);
		}
	}

	private static async Task MigrateAsync(VetiFlowDbContext dbContext, string? migrationConnectionString)
	{
		if (string.IsNullOrWhiteSpace(migrationConnectionString))
		{
			await dbContext.Database.MigrateAsync();
			return;
		}

		await using var migrationContext = new VetiFlowDbContext(
			new DbContextOptionsBuilder<VetiFlowDbContext>()
				.UseNpgsql(migrationConnectionString)
				.Options);
		await migrationContext.Database.MigrateAsync();
	}
}
