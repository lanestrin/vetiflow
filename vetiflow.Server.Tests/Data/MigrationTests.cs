using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using vetiflow.Server.Data;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

// Tests that migrate run on their own empty database.
public class MigrationTests(VetiFlowApiFactory factory)
{
	private const string InitialCreate = "20260904010253_InitialCreate";

	private const string DataModelIntegrity = "20261024141817_DataModelIntegrity";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	// Fails when the model changed without a migration being added.
	[Fact]
	public void Model_MatchesLatestMigration()
	{
		using var dbContext = factory.CreateDbContext();

		Assert.False(
			dbContext.Database.HasPendingModelChanges(),
			"The model has changes not captured in a migration. Run 'dotnet ef migrations add'.");
	}

	[Fact]
	public async Task Migrations_ApplyRollBackAndReapplyCleanly()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);
		await migrator.MigrateAsync(Migration.InitialDatabase, _cancellationToken);
		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		Assert.Empty(await dbContext.Database.GetPendingMigrationsAsync(_cancellationToken));
	}

	// DataModelIntegrity switched enum columns from integers to names; rows
	// written before it must keep their meaning.
	[Fact]
	public async Task DataModelIntegrity_ConvertsExistingEnumValuesToNames()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(InitialCreate, _cancellationToken);

		var staffId = Guid.NewGuid();
		var roomId = Guid.NewGuid();
		var patientId = Guid.NewGuid();
		var caseId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "StaffMembers" ("Id", "FirstName", "LastName", "Role", "IsActive")
			VALUES ({staffId}, 'Sam', 'Ortiz', 1, TRUE)
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "Rooms" ("Id", "Name", "Type", "IsAvailable")
			VALUES ({roomId}, 'ICU', 2, FALSE)
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "Patients" ("Id", "Name", "Species")
			VALUES ({patientId}, 'Buddy', 'Dog')
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "EmergencyCases"
				("Id", "PatientId", "ArrivalTime", "PresentingComplaint",
				 "Stage", "Status", "Acuity", "RoomId", "LastUpdated")
			VALUES ({caseId}, {patientId}, {now}, 'Collapse', 2, 4, 0, {roomId}, {now})
			""", _cancellationToken);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var staff = await dbContext.StaffMembers.SingleAsync(s => s.Id == staffId, _cancellationToken);
		var room = await dbContext.Rooms.SingleAsync(r => r.Id == roomId, _cancellationToken);
		var emergencyCase = await dbContext.EmergencyCases.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(StaffRole.Technician, staff.Role);
		Assert.Equal(RoomType.ICU, room.Type);
		Assert.Equal(CaseStage.Treatment, emergencyCase.Stage);
		Assert.Equal(CaseStatus.Blocked, emergencyCase.Status);
		Assert.Equal(AcuityLevel.Critical, emergencyCase.Acuity);
	}

	// AddOwners adds a non-null status column; cases written before it must get
	// a valid enum name, and their patients keep no owner.
	[Fact]
	public async Task AddOwners_ExistingCasesStartNotYetUpdated()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(DataModelIntegrity, _cancellationToken);

		var patientId = Guid.NewGuid();
		var caseId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "Patients" ("Id", "Name", "Species")
			VALUES ({patientId}, 'Buddy', 'Dog')
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "EmergencyCases"
				("Id", "PatientId", "ArrivalTime", "PresentingComplaint",
				 "Stage", "Status", "LastUpdated")
			VALUES ({caseId}, {patientId}, {now}, 'Collapse', 'Triage', 'Unassigned', {now})
			""", _cancellationToken);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var emergencyCase = await dbContext.EmergencyCases
			.Include(c => c.Patient)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(OwnerUpdateStatus.NotYetUpdated, emergencyCase.OwnerUpdateStatus);
		Assert.Null(emergencyCase.LastOwnerUpdateAt);
		Assert.Null(emergencyCase.Patient.OwnerId);
	}

	private async Task<VetiFlowDbContext> CreateEmptyDatabaseAsync() =>
		VetiFlowApiFactory.CreateDbContext(await factory.Postgres.CreateDatabaseAsync());
}
