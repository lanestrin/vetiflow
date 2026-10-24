using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

public class DbSeederTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	// Startup seeds on every boot, so a second run must not duplicate data.
	[Fact]
	public async Task SeedAsync_PopulatesEmptyDatabaseOnce()
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(
			await factory.Postgres.CreateDatabaseAsync());
		await dbContext.Database.MigrateAsync(_cancellationToken);

		await DbSeeder.SeedAsync(dbContext);
		var casesAfterFirstRun = await dbContext.EmergencyCases.CountAsync(_cancellationToken);
		var patientsAfterFirstRun = await dbContext.Patients.CountAsync(_cancellationToken);

		dbContext.ChangeTracker.Clear();
		await DbSeeder.SeedAsync(dbContext);

		Assert.True(casesAfterFirstRun > 0, "Seeding should create demo cases.");
		Assert.Equal(casesAfterFirstRun, await dbContext.EmergencyCases.CountAsync(_cancellationToken));
		Assert.Equal(patientsAfterFirstRun, await dbContext.Patients.CountAsync(_cancellationToken));
	}
}
