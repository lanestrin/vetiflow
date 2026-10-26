using Microsoft.EntityFrameworkCore;

namespace vetiflow.Server.Data;

// What startup may do to the database. Both settings are off unless set, so a
// production deploy never changes the schema or adds demo rows by accident.
// The production migration step is in blueprint/project-plan.md, section 8.
public static class DatabaseStartup
{
	public static async Task PrepareAsync(
		VetiFlowDbContext dbContext,
		bool migrateOnStartup,
		bool seedDemoData,
		ILogger logger)
	{
		if (migrateOnStartup)
		{
			// Fails loudly on purpose: someone asked for this migration.
			await dbContext.Database.MigrateAsync();
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
					"Set Database__MigrateOnStartup=true for this deploy, then set it back to false.");
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
}
