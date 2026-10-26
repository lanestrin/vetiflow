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

	private const string EnableRowLevelSecurity = "20261026153851_EnableRowLevelSecurity";

	private const string MoveVitalsToVitalsRecords = "20261026161248_MoveVitalsToVitalsRecords";

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

	// MoveVitalsToVitalsRecords moves clinical rows between tables; none may be
	// lost on the way, and an assessment without vitals gets no record.
	[Fact]
	public async Task MoveVitalsToVitalsRecords_KeepsExistingVitals()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(EnableRowLevelSecurity, _cancellationToken);
		var rows = await InsertAssessmentsWithAndWithoutVitalsAsync(dbContext);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var vitals = await dbContext.VitalsRecords.SingleAsync(_cancellationToken);
		Assert.Equal(rows.WithVitalsId, vitals.Id);
		Assert.Equal(rows.CaseId, vitals.EmergencyCaseId);
		Assert.Equal(168, vitals.HeartRate);
		Assert.Equal(44, vitals.RespiratoryRate);
		Assert.Equal(103.1m, vitals.TemperatureF);
		Assert.Equal("Pale", vitals.MucousMembraneColor);
		Assert.Equal(">2 s", vitals.CapillaryRefillTime);
		Assert.Equal("Restless", vitals.Mentation);
		Assert.Equal(rows.AssessedAt, vitals.RecordedAt);
		Assert.Equal(rows.StaffId, vitals.RecordedByStaffId);

		var assessments = await dbContext.TriageAssessments
			.OrderBy(a => a.AssessedAt)
			.ToListAsync(_cancellationToken);
		Assert.Equal(2, assessments.Count);
		Assert.All(assessments, a => Assert.Equal(AcuityLevel.Critical, a.Acuity));
		Assert.Equal("Retching for an hour.", assessments[0].RawIntakeNotes);
	}

	[Fact]
	public async Task MoveVitalsToVitalsRecords_RollBackRestoresVitals()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(EnableRowLevelSecurity, _cancellationToken);
		var rows = await InsertAssessmentsWithAndWithoutVitalsAsync(dbContext);
		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		await migrator.MigrateAsync(EnableRowLevelSecurity, _cancellationToken);

		var restored = await dbContext.Database
			.SqlQuery<string>($"""
				SELECT concat_ws('/', "HeartRate", "RespiratoryRate", "TemperatureF",
				                 "MucousMembraneColor", "CapillaryRefillTime", "Mentation") AS "Value"
				FROM "TriageAssessments" WHERE "Id" = {rows.WithVitalsId}
				""")
			.SingleAsync(_cancellationToken);
		Assert.Equal("168/44/103.1/Pale/>2 s/Restless", restored);
	}

	// Enums are stored by name, so renaming Stable to High must update the rows.
	[Fact]
	public async Task RenameStableAcuityToHigh_UpdatesStoredRows()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(MoveVitalsToVitalsRecords, _cancellationToken);
		var rows = await InsertStableAndCriticalCasesAsync(dbContext);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var stableCase = await dbContext.EmergencyCases.SingleAsync(c => c.Id == rows.StableCaseId, _cancellationToken);
		var criticalCase = await dbContext.EmergencyCases.SingleAsync(c => c.Id == rows.CriticalCaseId, _cancellationToken);
		var assessment = await dbContext.TriageAssessments.SingleAsync(a => a.Id == rows.AssessmentId, _cancellationToken);
		Assert.Equal(AcuityLevel.High, stableCase.Acuity);
		Assert.Equal(AcuityLevel.High, assessment.Acuity);
		Assert.Equal(AcuityLevel.Critical, criticalCase.Acuity);
	}

	[Fact]
	public async Task RenameStableAcuityToHigh_RollBackRestoresStable()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(MoveVitalsToVitalsRecords, _cancellationToken);
		var rows = await InsertStableAndCriticalCasesAsync(dbContext);
		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		await migrator.MigrateAsync(MoveVitalsToVitalsRecords, _cancellationToken);

		var stored = await dbContext.Database
			.SqlQuery<string>($"""
				SELECT c."Acuity" || '/' || t."Acuity" AS "Value"
				FROM "EmergencyCases" c JOIN "TriageAssessments" t ON t."EmergencyCaseId" = c."Id"
				WHERE c."Id" = {rows.StableCaseId}
				""")
			.SingleAsync(_cancellationToken);
		Assert.Equal("Stable/Stable", stored);
	}

	// Rows in the shape before RenameStableAcuityToHigh: one case and its
	// assessment at Stable, one case at Critical.
	private async Task<(Guid StableCaseId, Guid CriticalCaseId, Guid AssessmentId)>
		InsertStableAndCriticalCasesAsync(VetiFlowDbContext dbContext)
	{
		var stablePatientId = Guid.NewGuid();
		var criticalPatientId = Guid.NewGuid();
		var stableCaseId = Guid.NewGuid();
		var criticalCaseId = Guid.NewGuid();
		var assessmentId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "Patients" ("Id", "Name", "Species")
			VALUES ({stablePatientId}, 'Max', 'Dog'), ({criticalPatientId}, 'Buddy', 'Dog')
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "EmergencyCases"
				("Id", "PatientId", "ArrivalTime", "PresentingComplaint",
				 "Stage", "Status", "Acuity", "LastUpdated", "OwnerUpdateStatus")
			VALUES ({stableCaseId}, {stablePatientId}, {now}, 'Lameness', 'Treatment', 'Assigned', 'Stable', {now}, 'NotYetUpdated'),
			       ({criticalCaseId}, {criticalPatientId}, {now}, 'Retching', 'Triage', 'Blocked', 'Critical', {now}, 'NotYetUpdated')
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "TriageAssessments" ("Id", "EmergencyCaseId", "Acuity", "AssessedAt")
			VALUES ({assessmentId}, {stableCaseId}, 'Stable', {now})
			""", _cancellationToken);
		return (stableCaseId, criticalCaseId, assessmentId);
	}

	// Rows in the shape before MoveVitalsToVitalsRecords: one assessment with
	// vitals, one without.
	private async Task<(Guid CaseId, Guid WithVitalsId, Guid StaffId, DateTimeOffset AssessedAt)>
		InsertAssessmentsWithAndWithoutVitalsAsync(VetiFlowDbContext dbContext)
	{
		var staffId = Guid.NewGuid();
		var patientId = Guid.NewGuid();
		var caseId = Guid.NewGuid();
		var withVitalsId = Guid.NewGuid();
		var withoutVitalsId = Guid.NewGuid();
		// A whole-second time, so the value read back from Postgres compares equal.
		var assessedAt = new DateTimeOffset(2026, 10, 20, 14, 30, 0, TimeSpan.Zero);
		var now = DateTimeOffset.UtcNow;
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "StaffMembers" ("Id", "FirstName", "LastName", "Role", "IsActive")
			VALUES ({staffId}, 'Jordan', 'Lee', 'Veterinarian', TRUE)
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "Patients" ("Id", "Name", "Species") VALUES ({patientId}, 'Buddy', 'Dog')
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "EmergencyCases"
				("Id", "PatientId", "ArrivalTime", "PresentingComplaint",
				 "Stage", "Status", "Acuity", "LastUpdated", "OwnerUpdateStatus")
			VALUES ({caseId}, {patientId}, {now}, 'Retching', 'Triage', 'Unassigned', 'Critical', {now}, 'NotYetUpdated')
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "TriageAssessments"
				("Id", "EmergencyCaseId", "Acuity", "HeartRate", "RespiratoryRate", "TemperatureF",
				 "MucousMembraneColor", "CapillaryRefillTime", "Mentation", "RawIntakeNotes",
				 "AssessedAt", "AssessedByStaffId")
			VALUES ({withVitalsId}, {caseId}, 'Critical', 168, 44, 103.1, 'Pale', '>2 s', 'Restless',
				'Retching for an hour.', {assessedAt}, {staffId})
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "TriageAssessments" ("Id", "EmergencyCaseId", "Acuity", "AssessedAt")
			VALUES ({withoutVitalsId}, {caseId}, 'Critical', {assessedAt.AddMinutes(10)})
			""", _cancellationToken);
		return (caseId, withVitalsId, staffId, assessedAt);
	}

	private async Task<VetiFlowDbContext> CreateEmptyDatabaseAsync() =>
		VetiFlowApiFactory.CreateDbContext(await factory.Postgres.CreateDatabaseAsync());
}
