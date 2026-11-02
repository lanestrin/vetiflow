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

	private const string RenameStableAcuityToHigh = "20261026163355_RenameStableAcuityToHigh";

	private const string AddAccounts = "20261027002959_AddAccounts";

	private const string ThreeAcuityLevels = "20261028152018_ThreeAcuityLevels";

	private const string AddCaseNumbers = "20261028161946_AddCaseNumbers";

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

		await migrator.MigrateAsync(RenameStableAcuityToHigh, _cancellationToken);

		Assert.Equal("High/High", await ReadStoredAcuityAsync(dbContext, rows.StableCaseId));
		Assert.Equal("Critical", await ReadStoredCaseAcuityAsync(dbContext, rows.CriticalCaseId));
	}

	[Fact]
	public async Task RenameStableAcuityToHigh_RollBackRestoresStable()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(MoveVitalsToVitalsRecords, _cancellationToken);
		var rows = await InsertStableAndCriticalCasesAsync(dbContext);
		await migrator.MigrateAsync(RenameStableAcuityToHigh, _cancellationToken);

		await migrator.MigrateAsync(MoveVitalsToVitalsRecords, _cancellationToken);

		Assert.Equal("Stable/Stable", await ReadStoredAcuityAsync(dbContext, rows.StableCaseId));
	}

	// Three levels (build plan 0.4a): High folds into Urgent and Low becomes
	// Stable, on cases and on triage history. Critical and Urgent are untouched.
	[Fact]
	public async Task ThreeAcuityLevels_UpdatesStoredRows()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(AddAccounts, _cancellationToken);
		var caseIds = await InsertTriagedCasesAsync(dbContext, "Critical", "Urgent", "High", "Low");

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		Assert.Equal("Critical/Critical", await ReadStoredAcuityAsync(dbContext, caseIds[0]));
		Assert.Equal("Urgent/Urgent", await ReadStoredAcuityAsync(dbContext, caseIds[1]));
		Assert.Equal("Urgent/Urgent", await ReadStoredAcuityAsync(dbContext, caseIds[2]));
		Assert.Equal("Stable/Stable", await ReadStoredAcuityAsync(dbContext, caseIds[3]));
	}

	// Down can only undo the Low rename: once High is folded into Urgent,
	// nothing records which Urgent rows were High.
	[Fact]
	public async Task ThreeAcuityLevels_RollBackRestoresLow()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(AddAccounts, _cancellationToken);
		var caseIds = await InsertTriagedCasesAsync(dbContext, "High", "Low");
		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		await migrator.MigrateAsync(AddAccounts, _cancellationToken);

		Assert.Equal("Urgent/Urgent", await ReadStoredAcuityAsync(dbContext, caseIds[0]));
		Assert.Equal("Low/Low", await ReadStoredAcuityAsync(dbContext, caseIds[1]));
	}

	// Case numbers (build plan 3.4a): existing cases are numbered from 2401 in
	// arrival order, and the next new case continues after them.
	[Fact]
	public async Task AddCaseNumbers_NumbersExistingCasesByArrival()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(ThreeAcuityLevels, _cancellationToken);
		var now = DateTimeOffset.UtcNow;
		// Inserted newest first, so numbering by insertion order would fail.
		var newest = await InsertCaseArrivedAtAsync(dbContext, now.AddMinutes(-5));
		var oldest = await InsertCaseArrivedAtAsync(dbContext, now.AddMinutes(-90));
		var middle = await InsertCaseArrivedAtAsync(dbContext, now.AddMinutes(-30));

		await migrator.MigrateAsync(AddCaseNumbers, _cancellationToken);

		Assert.Equal(2401, await ReadCaseNumberAsync(dbContext, oldest));
		Assert.Equal(2402, await ReadCaseNumberAsync(dbContext, middle));
		Assert.Equal(2403, await ReadCaseNumberAsync(dbContext, newest));
		var next = await InsertCaseArrivedAtAsync(dbContext, now);
		Assert.Equal(2404, await ReadCaseNumberAsync(dbContext, next));
	}

	// Stage time (build plan 2.11a): no stage history is stored, so existing
	// cases take their arrival time.
	[Fact]
	public async Task AddStageEnteredAt_BackfillsArrivalTime()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync(AddCaseNumbers, _cancellationToken);
		// A whole-second time, so the value read back from Postgres compares equal.
		var arrivalTime = new DateTimeOffset(2026, 10, 28, 9, 15, 0, TimeSpan.Zero);
		var caseId = await InsertCaseArrivedAtAsync(dbContext, arrivalTime);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var stageEnteredAt = await dbContext.Database
			.SqlQuery<DateTimeOffset>($"""SELECT "StageEnteredAt" AS "Value" FROM "EmergencyCases" WHERE "Id" = {caseId}""")
			.SingleAsync(_cancellationToken);
		Assert.Equal(arrivalTime, stageEnteredAt);
	}

	// A case in the shape before AddCaseNumbers (and just after it: the number
	// is left to the database).
	private async Task<Guid> InsertCaseArrivedAtAsync(VetiFlowDbContext dbContext, DateTimeOffset arrivalTime)
	{
		var patientId = Guid.NewGuid();
		var caseId = Guid.NewGuid();
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "Patients" ("Id", "Name", "Species") VALUES ({patientId}, 'Max', 'Dog')
			""", _cancellationToken);
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "EmergencyCases"
				("Id", "PatientId", "ArrivalTime", "PresentingComplaint",
				 "Stage", "Status", "LastUpdated", "OwnerUpdateStatus")
			VALUES ({caseId}, {patientId}, {arrivalTime}, 'Lameness', 'Incoming', 'Unassigned', {arrivalTime}, 'NotYetUpdated')
			""", _cancellationToken);
		return caseId;
	}

	private async Task<int> ReadCaseNumberAsync(VetiFlowDbContext dbContext, Guid caseId) =>
		await dbContext.Database
			.SqlQuery<int>($"""SELECT "CaseNumber" AS "Value" FROM "EmergencyCases" WHERE "Id" = {caseId}""")
			.SingleAsync(_cancellationToken);

	// One case per acuity name, each with one assessment at the same name,
	// written as raw text so the rows don't depend on today's enum.
	private async Task<List<Guid>> InsertTriagedCasesAsync(
		VetiFlowDbContext dbContext, params string[] acuities)
	{
		var caseIds = new List<Guid>();
		var now = DateTimeOffset.UtcNow;
		foreach (var acuity in acuities)
		{
			var patientId = Guid.NewGuid();
			var caseId = Guid.NewGuid();
			await dbContext.Database.ExecuteSqlAsync($"""
				INSERT INTO "Patients" ("Id", "Name", "Species") VALUES ({patientId}, 'Max', 'Dog')
				""", _cancellationToken);
			await dbContext.Database.ExecuteSqlAsync($"""
				INSERT INTO "EmergencyCases"
					("Id", "PatientId", "ArrivalTime", "PresentingComplaint",
					 "Stage", "Status", "Acuity", "LastUpdated", "OwnerUpdateStatus")
				VALUES ({caseId}, {patientId}, {now}, 'Lameness', 'Treatment', 'Assigned', {acuity}, {now}, 'NotYetUpdated')
				""", _cancellationToken);
			await dbContext.Database.ExecuteSqlAsync($"""
				INSERT INTO "TriageAssessments" ("Id", "EmergencyCaseId", "Acuity", "AssessedAt")
				VALUES ({Guid.NewGuid()}, {caseId}, {acuity}, {now})
				""", _cancellationToken);
			caseIds.Add(caseId);
		}
		return caseIds;
	}

	// "<case acuity>/<assessment acuity>" as stored, for a case with one assessment.
	private async Task<string> ReadStoredAcuityAsync(VetiFlowDbContext dbContext, Guid caseId) =>
		await dbContext.Database
			.SqlQuery<string>($"""
				SELECT c."Acuity" || '/' || t."Acuity" AS "Value"
				FROM "EmergencyCases" c JOIN "TriageAssessments" t ON t."EmergencyCaseId" = c."Id"
				WHERE c."Id" = {caseId}
				""")
			.SingleAsync(_cancellationToken);

	private async Task<string> ReadStoredCaseAcuityAsync(VetiFlowDbContext dbContext, Guid caseId) =>
		await dbContext.Database
			.SqlQuery<string>($"""SELECT "Acuity" AS "Value" FROM "EmergencyCases" WHERE "Id" = {caseId}""")
			.SingleAsync(_cancellationToken);

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

	[Fact]
	public async Task AddAssessmentOccurredAt_PreservesHistoricalRowsWithUnknownEventTime()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync("20261029212524_AddPainScores", _cancellationToken);
		var staffId = await InsertStaffAsync(dbContext);
		var caseId = await InsertCaseAsync(dbContext);
		var enteredAt = new DateTimeOffset(2026, 10, 20, 14, 30, 0, TimeSpan.Zero);
		var vitalsId = Guid.NewGuid();
		var triageId = Guid.NewGuid();
		var painId = Guid.NewGuid();
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "VitalsRecords" ("Id", "EmergencyCaseId", "HeartRate", "RecordedAt", "RecordedByStaffId")
			VALUES ({vitalsId}, {caseId}, 140, {enteredAt}, {staffId});
			INSERT INTO "TriageAssessments" ("Id", "EmergencyCaseId", "Acuity", "RawIntakeNotes", "AssessedAt", "AssessedByStaffId")
			VALUES ({triageId}, {caseId}, 'Urgent', 'Historical intake', {enteredAt}, {staffId});
			INSERT INTO "PainScores" ("Id", "EmergencyCaseId", "Score", "Notes", "RecordedAt", "RecordedByStaffId")
			VALUES ({painId}, {caseId}, 3, 'Historical pain', {enteredAt}, {staffId});
			""", _cancellationToken);
		var before = await ReadHistoricalAssessmentsAsync(dbContext);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var columnCount = await dbContext.Database.SqlQuery<int>($"""
			SELECT COUNT(*)::int AS "Value" FROM information_schema.columns
			WHERE table_schema = 'public' AND column_name = 'OccurredAt'
			AND table_name IN ('VitalsRecords', 'TriageAssessments', 'PainScores')
			AND is_nullable = 'YES' AND column_default IS NULL
			""").SingleAsync(_cancellationToken);
		Assert.Equal(3, columnCount);
		Assert.Equal(before, await ReadHistoricalAssessmentsAsync(dbContext));
		var knownTimes = await dbContext.Database.SqlQuery<int>($"""
			SELECT (SELECT COUNT(*) FROM "VitalsRecords" WHERE "OccurredAt" IS NOT NULL)::int
			+ (SELECT COUNT(*) FROM "TriageAssessments" WHERE "OccurredAt" IS NOT NULL)::int
			+ (SELECT COUNT(*) FROM "PainScores" WHERE "OccurredAt" IS NOT NULL)::int AS "Value"
			""").SingleAsync(_cancellationToken);
		Assert.Equal(0, knownTimes);
	}

	// Cases moved to Discharge before 4.21a have no discharge time, so they
	// stayed on the board; the backfill discharges them when they entered the stage.
	[Fact]
	public async Task BackfillDischargedAt_DischargesOldDischargeStageCases()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync("20261101160606_AddCaseTags", _cancellationToken);
		var enteredDischarge = new DateTimeOffset(2026, 10, 30, 19, 40, 0, TimeSpan.Zero);
		var dischargedEarlier = new DateTimeOffset(2026, 10, 29, 9, 15, 0, TimeSpan.Zero);
		var leftOnBoard = await InsertCaseAsync(dbContext, "Discharge", enteredDischarge);
		var active = await InsertCaseAsync(dbContext, "Triage");
		var alreadyDischarged = await InsertCaseAsync(dbContext, "Discharge", enteredDischarge, dischargedEarlier);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var discharged = await dbContext.EmergencyCases.AsNoTracking()
			.ToDictionaryAsync(c => c.Id, c => c.DischargedAt, _cancellationToken);
		Assert.Equal(enteredDischarge, discharged[leftOnBoard]);
		Assert.Null(discharged[active]);
		Assert.Equal(dischargedEarlier, discharged[alreadyDischarged]);
	}

	// Structured allergy status (4.12a): existing text is unverified, never a
	// verified negative, and blank text is not recorded.
	[Fact]
	public async Task AddAllergyStatus_ConvertsExistingText()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync("20261102005258_RemoveCaseTags", _cancellationToken);
		var withText = Guid.NewGuid();
		var blank = Guid.NewGuid();
		var none = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		foreach (var (id, allergies) in new[] { (withText, " None known "), (blank, "  "), (none, (string?)null) })
		{
			await dbContext.Database.ExecuteSqlAsync($"""
				INSERT INTO "Patients" ("Id", "Name", "Species", "Allergies") VALUES ({id}, 'Buddy', 'Dog', {allergies})
				""", _cancellationToken);
			await dbContext.Database.ExecuteSqlAsync($"""
				INSERT INTO "EmergencyCases"
					("Id", "PatientId", "ArrivalTime", "PresentingComplaint", "Stage", "StageEnteredAt",
					 "Status", "LastUpdated", "OwnerUpdateStatus", "TreatmentAuthorization", "AllergiesAtIntake")
				VALUES ({id}, {id}, {now}, 'Retching', 'Triage', {now},
					'Unassigned', {now}, 'NotYetUpdated', 'NotDiscussed', {allergies})
				""", _cancellationToken);
		}

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var patients = await dbContext.Patients.AsNoTracking()
			.ToDictionaryAsync(p => p.Id, p => (p.AllergyStatus, p.Allergies), _cancellationToken);
		var cases = await dbContext.EmergencyCases.AsNoTracking()
			.ToDictionaryAsync(c => c.Id, c => (c.AllergyStatusAtIntake, c.AllergiesAtIntake), _cancellationToken);
		foreach (var records in new[] { patients, cases })
		{
			Assert.Equal((AllergyStatus.UnknownOrUnverified, "None known"), records[withText]);
			Assert.Equal((AllergyStatus.NotRecorded, (string?)null), records[blank]);
			Assert.Equal((AllergyStatus.NotRecorded, (string?)null), records[none]);
		}
	}

	// Free-text tags were removed (build plan 3.5c): the stored tags go, but the
	// timeline keeps what happened.
	[Fact]
	public async Task RemoveCaseTags_DropsTagsAndKeepsTimeline()
	{
		await using var dbContext = await CreateEmptyDatabaseAsync();
		var migrator = dbContext.GetService<IMigrator>();
		await migrator.MigrateAsync("20261102002838_BackfillDischargedAt", _cancellationToken);
		var caseId = await InsertCaseAsync(dbContext);
		var tagAddedId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "CaseEvents" ("Id", "EmergencyCaseId", "Type", "Description", "CreatedAt")
			VALUES ({tagAddedId}, {caseId}, 'TagAdded', 'Tag added: O2 support', {now});
			INSERT INTO "CaseTags" ("Id", "EmergencyCaseId", "Text", "Tone", "CreatedAt")
			VALUES ({Guid.NewGuid()}, {caseId}, 'O2 support', 'Caution', {now});
			""", _cancellationToken);

		await migrator.MigrateAsync(cancellationToken: _cancellationToken);

		var tagTables = await dbContext.Database.SqlQuery<int>($"""
			SELECT COUNT(*)::int AS "Value" FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'CaseTags'
			""").SingleAsync(_cancellationToken);
		Assert.Equal(0, tagTables);
		var timeline = await dbContext.CaseEvents.AsNoTracking()
			.SingleAsync(caseEvent => caseEvent.Id == tagAddedId, _cancellationToken);
		Assert.Equal(CaseEventType.TagAdded, timeline.Type);
		Assert.Equal("Tag added: O2 support", timeline.Description);
	}

	private async Task<string[]> ReadHistoricalAssessmentsAsync(VetiFlowDbContext dbContext) =>
		await dbContext.Database.SqlQuery<string>($"""
			SELECT (to_jsonb(v) - 'OccurredAt')::text AS "Value" FROM "VitalsRecords" v
			UNION ALL SELECT (to_jsonb(t) - 'OccurredAt')::text FROM "TriageAssessments" t
			UNION ALL SELECT (to_jsonb(p) - 'OccurredAt')::text FROM "PainScores" p
			ORDER BY "Value"
			""").ToArrayAsync(_cancellationToken);

	// Rows for tests that stop at an older migration: inserted with SQL, because
	// the current model has columns that schema does not have yet.
	private async Task<Guid> InsertStaffAsync(VetiFlowDbContext dbContext)
	{
		var staffId = Guid.NewGuid();
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "StaffMembers" ("Id", "FirstName", "LastName", "Role", "IsActive")
			VALUES ({staffId}, 'Jordan', 'Lee', 'Veterinarian', TRUE)
			""", _cancellationToken);
		return staffId;
	}

	private async Task<Guid> InsertCaseAsync(
		VetiFlowDbContext dbContext,
		string stage = "Triage",
		DateTimeOffset? stageEnteredAt = null,
		DateTimeOffset? dischargedAt = null)
	{
		var patientId = Guid.NewGuid();
		var caseId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		await dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO "Patients" ("Id", "Name", "Species") VALUES ({patientId}, 'Buddy', 'Dog');
			INSERT INTO "EmergencyCases"
				("Id", "PatientId", "ArrivalTime", "PresentingComplaint", "Stage", "StageEnteredAt",
				 "Status", "LastUpdated", "OwnerUpdateStatus", "TreatmentAuthorization", "DischargedAt")
			VALUES ({caseId}, {patientId}, {now}, 'Vomiting', {stage}, {stageEnteredAt ?? now},
				'Unassigned', {now}, 'NotYetUpdated', 'NotDiscussed', {dischargedAt});
			""", _cancellationToken);
		return caseId;
	}

	private async Task<VetiFlowDbContext> CreateEmptyDatabaseAsync() =>
		VetiFlowApiFactory.CreateDbContext(await factory.Postgres.CreateDatabaseAsync());
}
