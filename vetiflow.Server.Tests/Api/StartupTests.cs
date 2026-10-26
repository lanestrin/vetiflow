using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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
		using var host = TestHosts.Create(connectionString, environment: "Production");

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
		using var host = TestHosts.Create(connectionString, migrateOnStartup: true);

		_ = host.Server;

		await using var dbContext = VetiFlowApiFactory.CreateDbContext(connectionString);
		Assert.Empty(await dbContext.Database.GetPendingMigrationsAsync(_cancellationToken));
	}

	[Fact]
	public async Task Startup_WithSeedOff_LeavesDatabaseEmpty()
	{
		var connectionString = await factory.Postgres.CreateDatabaseAsync();
		using var host = TestHosts.Create(connectionString, migrateOnStartup: true, seedDemoData: false);

		_ = host.Server;

		await using var dbContext = VetiFlowApiFactory.CreateDbContext(connectionString);
		Assert.Equal(0, await dbContext.EmergencyCases.CountAsync(_cancellationToken));
	}

	// A database outage must show on /api/health, not stop the app from starting.
	[Fact]
	public async Task Startup_WithDatabaseUnreachable_StartsAndReportsUnhealthy()
	{
		using var host = TestHosts.Create(TestHosts.UnreachableDatabase, environment: "Production");
		using var client = host.CreateClient();

		var response = await client.GetAsync("/api/health", _cancellationToken);

		Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
		var body = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal("disconnected", body.GetProperty("database").GetString());
	}
}
