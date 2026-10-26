using Microsoft.EntityFrameworkCore;
using Npgsql;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Data;

public class DatabaseConstraintTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Patient_CannotHaveTwoActiveCases()
	{
		var patient = TestData.Patient();
		await SaveAsync(TestData.Case(patient));

		await using var dbContext = factory.CreateDbContext();
		dbContext.Attach(patient);
		dbContext.EmergencyCases.Add(TestData.Case(patient));

		await AssertViolatesAsync(
			dbContext,
			PostgresErrorCodes.UniqueViolation,
			"IX_EmergencyCases_PatientId_Active");
	}

	[Fact]
	public async Task Patient_WithOnlyDischargedCases_CanStartNewCase()
	{
		var patient = TestData.Patient();
		var discharged = TestData.Case(patient);
		discharged.DischargedAt = DateTimeOffset.UtcNow;
		await SaveAsync(discharged);

		await using var dbContext = factory.CreateDbContext();
		dbContext.Attach(patient);
		dbContext.EmergencyCases.Add(TestData.Case(patient));

		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	[Fact]
	public async Task Room_CannotHoldTwoActiveCases()
	{
		var room = TestData.Room();
		await SaveAsync(TestData.Case(TestData.Patient(), room));

		await using var dbContext = factory.CreateDbContext();
		dbContext.Attach(room);
		dbContext.EmergencyCases.Add(TestData.Case(TestData.Patient(), room));

		await AssertViolatesAsync(
			dbContext,
			PostgresErrorCodes.UniqueViolation,
			"IX_EmergencyCases_RoomId_Active");
	}

	[Fact]
	public async Task Room_FreedByDischarge_CanTakeNewCase()
	{
		var room = TestData.Room();
		var discharged = TestData.Case(TestData.Patient(), room);
		discharged.DischargedAt = DateTimeOffset.UtcNow;
		await SaveAsync(discharged);

		await using var dbContext = factory.CreateDbContext();
		dbContext.Attach(room);
		dbContext.EmergencyCases.Add(TestData.Case(TestData.Patient(), room));

		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	[Fact]
	public async Task Patient_WithCaseHistory_CannotBeDeleted()
	{
		var patient = TestData.Patient();
		await SaveAsync(TestData.Case(patient));

		await using var dbContext = factory.CreateDbContext();

		await AssertViolatesAsync(
			() => dbContext.Patients
				.Where(p => p.Id == patient.Id)
				.ExecuteDeleteAsync(_cancellationToken),
			PostgresErrorCodes.ForeignKeyViolation,
			"FK_EmergencyCases_Patients_PatientId");
	}

	[Fact]
	public async Task Owner_WithPatient_CannotBeDeleted()
	{
		var owner = TestData.Owner();
		var patient = TestData.Patient();
		patient.Owner = owner;
		await SaveAsync(TestData.Case(patient));

		await using var dbContext = factory.CreateDbContext();

		await AssertViolatesAsync(
			() => dbContext.Owners
				.Where(o => o.Id == owner.Id)
				.ExecuteDeleteAsync(_cancellationToken),
			PostgresErrorCodes.ForeignKeyViolation,
			"FK_Patients_Owners_OwnerId");
	}

	[Fact]
	public async Task Case_WithTriageHistory_CannotBeDeleted()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Stable });
		await SaveAsync(emergencyCase);

		await using var dbContext = factory.CreateDbContext();

		await AssertViolatesAsync(
			() => dbContext.EmergencyCases
				.Where(c => c.Id == emergencyCase.Id)
				.ExecuteDeleteAsync(_cancellationToken),
			PostgresErrorCodes.ForeignKeyViolation,
			"FK_TriageAssessments_EmergencyCases_EmergencyCaseId");
	}

	[Fact]
	public async Task Case_WithVitals_CannotBeDeleted()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.RecordVitals(new VitalsRecord { HeartRate = 120 });
		await SaveAsync(emergencyCase);

		await using var dbContext = factory.CreateDbContext();

		await AssertViolatesAsync(
			() => dbContext.EmergencyCases
				.Where(c => c.Id == emergencyCase.Id)
				.ExecuteDeleteAsync(_cancellationToken),
			PostgresErrorCodes.ForeignKeyViolation,
			"FK_VitalsRecords_EmergencyCases_EmergencyCaseId");
	}

	[Fact]
	public async Task Enums_AreStoredByName()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Diagnostics;
		emergencyCase.Status = CaseStatus.InProgress;
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Critical });
		await SaveAsync(emergencyCase);

		await using var dbContext = factory.CreateDbContext();
		var stored = await dbContext.Database
			.SqlQuery<string>($"""
				SELECT "Stage" || '/' || "Status" || '/' || "Acuity" AS "Value"
				FROM "EmergencyCases" WHERE "Id" = {emergencyCase.Id}
				""")
			.SingleAsync(_cancellationToken);

		Assert.Equal("Diagnostics/InProgress/Critical", stored);
	}

	[Fact]
	public async Task RecordTriage_PersistsAssessmentsAndCurrentAcuity()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Stable });
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Critical });
		await SaveAsync(emergencyCase);

		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases
			.Include(c => c.TriageAssessments)
			.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);

		Assert.Equal(AcuityLevel.Critical, saved.Acuity);
		Assert.Equal(
			[AcuityLevel.Critical, AcuityLevel.Stable],
			saved.TriageAssessments.Select(a => a.Acuity).Order());
	}

	private async Task SaveAsync(EmergencyCase emergencyCase)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private Task AssertViolatesAsync(
		DbContext dbContext,
		string sqlState,
		string constraintName) =>
		AssertViolatesAsync(
			() => dbContext.SaveChangesAsync(_cancellationToken),
			sqlState,
			constraintName);

	// SaveChanges wraps the database error in a DbUpdateException;
	// ExecuteDelete surfaces it directly.
	private static async Task AssertViolatesAsync(
		Func<Task> action,
		string sqlState,
		string constraintName)
	{
		var exception = await Record.ExceptionAsync(action);

		var postgresException = Assert.IsType<PostgresException>(
			exception is DbUpdateException ? exception.InnerException : exception);
		Assert.Equal(sqlState, postgresException.SqlState);
		Assert.Equal(constraintName, postgresException.ConstraintName);
	}
}
