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

	// The board summary needs the clinic's clock (2.12a); without it the app
	// must not start and quietly count shifts in UTC.
	[Fact]
	public async Task Startup_WithoutClinicTimeZone_Fails()
	{
		var connectionString = await factory.Postgres.CreateDatabaseAsync();
		using var host = TestHosts.Create(
			connectionString,
			migrateOnStartup: true,
			settings: new Dictionary<string, string> { ["Clinic:TimeZone"] = "" });

		var exception = Record.Exception(() => host.Server);

		Assert.NotNull(exception);
		Assert.Contains("Clinic:TimeZone", exception.ToString());
	}

	// The board heading names the clinic (2.15a), so a missing name stops startup.
	[Fact]
	public async Task Startup_WithoutClinicName_Fails()
	{
		var connectionString = await factory.Postgres.CreateDatabaseAsync();
		using var host = TestHosts.Create(
			connectionString,
			migrateOnStartup: true,
			settings: new Dictionary<string, string> { ["Clinic:Name"] = "" });

		var exception = Record.Exception(() => host.Server);

		Assert.NotNull(exception);
		Assert.Contains("Clinic:Name", exception.ToString());
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

	// Production's shape: the app runs as vetiflow_app and migrates only through
	// the privileged migration connection.
	[Fact]
	public async Task Startup_AsAppRole_WithMigrationConnection_ServesBoard()
	{
		var adminConnectionString = await factory.Postgres.CreateDatabaseAsync();
		await using var appLogin = await AppRoleLogin.CreateAsync(adminConnectionString);
		using var host = TestHosts.Create(
			appLogin.ConnectionString,
			migrateOnStartup: true,
			seedDemoData: true,
			migrationConnectionString: adminConnectionString);
		// Signing in reads the seeded account as vetiflow_app too.
		using var client = await host.CreateClient().SignInAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);
		var caseId = cases![0].GetProperty("id").GetGuid();
		var update = await client.PatchAsJsonAsync(
			$"/api/cases/{caseId}/status",
			new { stage = "treatment", status = "inProgress" },
			_cancellationToken);

		Assert.NotEmpty(cases);
		Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);
	}

	// Turning migrations on without the migration connection fails the deploy
	// instead of changing anything: the app role can't create tables.
	[Fact]
	public async Task Startup_AsAppRole_WithoutMigrationConnection_RefusesToMigrate()
	{
		var adminConnectionString = await factory.Postgres.CreateDatabaseAsync();
		await using var appLogin = await AppRoleLogin.CreateAsync(adminConnectionString);
		using var host = TestHosts.Create(appLogin.ConnectionString, migrateOnStartup: true);

		var exception = Record.Exception(() => host.Server);

		Assert.NotNull(exception);
		Assert.Contains("permission denied", exception.ToString());
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(adminConnectionString);
		Assert.Empty(await dbContext.Database.GetAppliedMigrationsAsync(_cancellationToken));
	}
}
