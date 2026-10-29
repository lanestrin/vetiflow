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
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
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
	public async Task StaffMember_Status_StoredAsText()
	{
		var staffMember = TestData.StaffMember(StaffRole.Technician);
		staffMember.Status = StaffStatus.AtLimit;
		await using (var saveContext = factory.CreateDbContext())
		{
			saveContext.StaffMembers.Add(staffMember);
			await saveContext.SaveChangesAsync(_cancellationToken);
		}

		await using var dbContext = factory.CreateDbContext();
		var stored = await dbContext.Database
			.SqlQuery<string>($"""SELECT "Status" AS "Value" FROM "StaffMembers" WHERE "Id" = {staffMember.Id}""")
			.SingleAsync(_cancellationToken);

		Assert.Equal("AtLimit", stored);
	}

	// What staff rows that existed before the column get (2.21a).
	[Fact]
	public async Task StaffMember_Status_DefaultsToUnavailable()
	{
		var id = Guid.NewGuid();
		await using var dbContext = factory.CreateDbContext();
		await dbContext.Database.ExecuteSqlAsync(
			$"""
			INSERT INTO "StaffMembers" ("Id", "FirstName", "LastName", "Role", "IsActive")
			VALUES ({id}, 'Staff', {id.ToString()}, 'Veterinarian', TRUE)
			""",
			_cancellationToken);

		var stored = await dbContext.StaffMembers.SingleAsync(staff => staff.Id == id, _cancellationToken);

		Assert.Equal(StaffStatus.Unavailable, stored.Status);
	}

	[Fact]
	public async Task RecordTriage_PersistsAssessmentsAndCurrentAcuity()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Critical });
		await SaveAsync(emergencyCase);

		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases
			.Include(c => c.TriageAssessments)
			.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);

		Assert.Equal(AcuityLevel.Critical, saved.Acuity);
		Assert.Equal(
			[AcuityLevel.Critical, AcuityLevel.Urgent],
			saved.TriageAssessments.Select(a => a.Acuity).Order());
	}

	// The database numbers each new case from a sequence (build plan 3.4a),
	// and two cases can never share a number.
	[Fact]
	public async Task CaseNumber_IsAssignedOnInsertAndUnique()
	{
		var first = TestData.Case(TestData.Patient());
		var second = TestData.Case(TestData.Patient());
		await SaveAsync(first);
		await SaveAsync(second);

		Assert.True(first.CaseNumber > 0);
		Assert.True(second.CaseNumber > first.CaseNumber);

		await using var dbContext = factory.CreateDbContext();
		// A number set by hand is sent as is, so the index must catch it.
		var duplicate = TestData.Case(TestData.Patient());
		duplicate.CaseNumber = first.CaseNumber;
		dbContext.EmergencyCases.Add(duplicate);

		await AssertViolatesAsync(
			dbContext,
			PostgresErrorCodes.UniqueViolation,
			"IX_EmergencyCases_CaseNumber");
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
