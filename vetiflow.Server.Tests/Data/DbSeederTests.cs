using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

public class DbSeederTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	// With Database:SeedDemoData on, startup seeds on every boot, so a second
	// run must not duplicate data.
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

	[Fact]
	public async Task SeedAsync_LinksEachDemoPatientToAnOwner()
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(
			await factory.Postgres.CreateDatabaseAsync());
		await dbContext.Database.MigrateAsync(_cancellationToken);

		await DbSeeder.SeedAsync(dbContext);

		var patients = await dbContext.Patients
			.Include(patient => patient.Owner)
			.ToListAsync(_cancellationToken);
		Assert.NotEmpty(patients);
		Assert.All(patients, patient => Assert.NotNull(patient.Owner));

		// Demo contact details must stay synthetic.
		var emails = patients.Select(patient => patient.Owner!.Email).OfType<string>();
		Assert.All(emails, email => Assert.EndsWith("@example.com", email));
	}
}
