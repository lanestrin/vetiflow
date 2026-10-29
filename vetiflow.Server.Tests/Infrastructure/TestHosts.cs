using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace vetiflow.Server.Tests.Infrastructure;

// Starts a host with its own settings, for tests that need something the shared
// VetiFlowApiFactory can't give them: another environment, startup settings or
// a database that is down.
public static class TestHosts
{
	// Port 1 on this machine: nothing listens there, so connecting fails fast.
	public const string UnreachableDatabase =
		"Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2";

	public static WebApplicationFactory<Program> Create(
		string connectionString,
		string environment = "Testing",
		bool? migrateOnStartup = null,
		bool? seedDemoData = null,
		string? migrationConnectionString = null,
		IReadOnlyDictionary<string, string>? settings = null) =>
		new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
		{
			builder.UseEnvironment(environment);
			builder.UseSetting("ConnectionStrings:VetiFlowDatabase", connectionString);

			if (migrationConnectionString is not null)
			{
				builder.UseSetting("ConnectionStrings:VetiFlowMigrations", migrationConnectionString);
			}

			// Unset means the app's own default, which is what production gets.
			if (migrateOnStartup is not null)
			{
				builder.UseSetting("Database:MigrateOnStartup", migrateOnStartup.ToString());
			}

			if (seedDemoData is not null)
			{
				builder.UseSetting("Database:SeedDemoData", seedDemoData.ToString());
			}

			foreach (var (key, value) in settings ?? new Dictionary<string, string>())
			{
				builder.UseSetting(key, value);
			}
		});
}
