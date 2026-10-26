using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Each test starts its own host on its own new database, because these tests
// are about what startup does to the database.
public class StartupTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	// Production sets no Database settings, so nothing may change its schema.
	[Fact]
	public async Task Startup_WithDefaultSettings_RefusesPendingMigrations()
	{
		var connectionString = await factory.Postgres.CreateDatabaseAsync();
		using var host = CreateHost(connectionString, environment: "Production");

		var exception = Record.Exception(() => host.Server);

		Assert.NotNull(exception);
		Assert.Contains("Database__MigrateOnStartup", exception.ToString());
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(connectionString);
		Assert.NotEmpty(await dbContext.Database.GetPendingMigrationsAsync(_cancellationToken));
	}

	[Fact]
	public async Task Startup_WithMigrateOnStartup_AppliesMigrations()
	{
		var connectionString = await factory.Postgres.CreateDatabaseAsync();
		using var host = CreateHost(connectionString, migrateOnStartup: true);

		_ = host.Server;

		await using var dbContext = VetiFlowApiFactory.CreateDbContext(connectionString);
		Assert.Empty(await dbContext.Database.GetPendingMigrationsAsync(_cancellationToken));
	}

	[Fact]
	public async Task Startup_WithSeedOff_LeavesDatabaseEmpty()
	{
		var connectionString = await factory.Postgres.CreateDatabaseAsync();
		using var host = CreateHost(connectionString, migrateOnStartup: true, seedDemoData: false);

		_ = host.Server;

		await using var dbContext = VetiFlowApiFactory.CreateDbContext(connectionString);
		Assert.Equal(0, await dbContext.EmergencyCases.CountAsync(_cancellationToken));
	}

	// A database outage must show on /api/health, not stop the app from starting.
	[Fact]
	public async Task Startup_WithDatabaseUnreachable_StartsAndReportsUnhealthy()
	{
		// Port 1 on this machine: nothing listens there, so connecting fails fast.
		const string unreachable =
			"Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2";
		using var host = CreateHost(unreachable, environment: "Production");
		using var client = host.CreateClient();

		var response = await client.GetAsync("/api/health", _cancellationToken);

		Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
		var body = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal("disconnected", body.GetProperty("database").GetString());
	}

	private static WebApplicationFactory<Program> CreateHost(
		string connectionString,
		string environment = "Testing",
		bool? migrateOnStartup = null,
		bool? seedDemoData = null) =>
		new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
		{
			builder.UseEnvironment(environment);
			builder.UseSetting("ConnectionStrings:VetiFlowDatabase", connectionString);

			// Unset means the app's own default, which is what production gets.
			if (migrateOnStartup is not null)
			{
				builder.UseSetting("Database:MigrateOnStartup", migrateOnStartup.ToString());
			}

			if (seedDemoData is not null)
			{
				builder.UseSetting("Database:SeedDemoData", seedDemoData.ToString());
			}
		});
}
