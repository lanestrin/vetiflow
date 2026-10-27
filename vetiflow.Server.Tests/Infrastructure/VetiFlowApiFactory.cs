using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;

namespace vetiflow.Server.Tests.Infrastructure;

// Hosts the real API in memory against a real PostgreSQL database. Startup
// migrates and seeds here, as in local development; production leaves both off
// (StartupTests covers that path).
// Shared by every test in the assembly; tests create their own rows and only
// assert on those, so they can run in parallel without resetting the database.
public sealed class VetiFlowApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
	private string _connectionString = "";

	public PostgresServer Postgres { get; private set; } = null!;

	public async ValueTask InitializeAsync()
	{
		Postgres = await PostgresServer.StartAsync();
		_connectionString = await Postgres.CreateDatabaseAsync();

		// Build the host now so startup failures surface here, not in a test.
		_ = Server;
	}

	public VetiFlowDbContext CreateDbContext() => CreateDbContext(_connectionString);

	// A client signed in as a seeded demo account (DemoAccounts).
	public Task<HttpClient> CreateSignedInClientAsync(string email) => CreateClient().SignInAsync(email);

	public static VetiFlowDbContext CreateDbContext(string connectionString) =>
		new(new DbContextOptionsBuilder<VetiFlowDbContext>()
			.UseNpgsql(connectionString)
			.Options);

	protected override void ConfigureWebHost(IWebHostBuilder builder)
	{
		// Not Development, so user secrets (and the developer's own database)
		// are never loaded.
		builder.UseEnvironment("Testing");
		builder.UseSetting("ConnectionStrings:VetiFlowDatabase", _connectionString);
		builder.UseSetting("Database:MigrateOnStartup", "true");
		builder.UseSetting("Database:SeedDemoData", "true");
	}

	public override async ValueTask DisposeAsync()
	{
		await base.DisposeAsync();

		if (Postgres is not null)
		{
			await Postgres.DisposeAsync();
		}
	}
}
