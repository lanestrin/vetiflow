using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Models;
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
	public async Task SeedAsync_RecordsVitalsForEveryCase()
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(
			await factory.Postgres.CreateDatabaseAsync());
		await dbContext.Database.MigrateAsync(_cancellationToken);

		await DbSeeder.SeedAsync(dbContext);

		var vitalsPerPatient = await dbContext.EmergencyCases
			.Select(emergencyCase => new
			{
				emergencyCase.Patient.Name,
				Count = emergencyCase.VitalsRecords.Count
			})
			.ToDictionaryAsync(item => item.Name, item => item.Count, _cancellationToken);
		Assert.All(vitalsPerPatient.Values, count => Assert.True(count >= 1));
		// Buddy has intake vitals and a technician's recheck.
		Assert.Equal(2, vitalsPerPatient["Buddy"]);
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

	// The two sign-ins from the login mockup, one per experience; the kind and
	// link come from the record, not the address.
	[Fact]
	public async Task SeedAsync_CreatesTheTwoDemoAccounts()
	{
		await using var dbContext = await SeededDatabaseAsync();

		var accounts = await dbContext.Accounts
			.Include(account => account.StaffMember)
			.Include(account => account.Owner)
			.OrderBy(account => account.Email)
			.ToListAsync(_cancellationToken);

		Assert.Collection(
			accounts,
			parent =>
			{
				Assert.Equal("parent@vetiflow.demo", parent.Email);
				Assert.Equal("+13125550102", parent.PhoneNumber);
				Assert.Equal(AccountKind.PetParent, parent.Kind);
				Assert.Equal("Morgan Hale", $"{parent.Owner!.FirstName} {parent.Owner.LastName}");
				Assert.True(parent.IsActive);
			},
			team =>
			{
				Assert.Equal("team@vetiflow.demo", team.Email);
				Assert.Equal("+13125550101", team.PhoneNumber);
				Assert.Equal(AccountKind.TeamMember, team.Kind);
				Assert.Equal("Jordan Lee", $"{team.StaffMember!.FirstName} {team.StaffMember.LastName}");
				Assert.True(team.IsActive);
			});
	}

	[Fact]
	public async Task SeedAsync_HashesDemoPasswords()
	{
		await using var dbContext = await SeededDatabaseAsync();
		var passwordHasher = new PasswordHasher<Account>();

		var accounts = await dbContext.Accounts.ToListAsync(_cancellationToken);

		Assert.Equal(2, accounts.Count);
		Assert.All(accounts, account =>
		{
			Assert.NotEqual(DbSeeder.DemoPassword, account.PasswordHash);
			Assert.Equal(
				PasswordVerificationResult.Success,
				passwordHasher.VerifyHashedPassword(account, account.PasswordHash!, DbSeeder.DemoPassword));
			Assert.Equal(
				PasswordVerificationResult.Failed,
				passwordHasher.VerifyHashedPassword(account, account.PasswordHash!, "not-the-password"));
		});
	}

	// Databases seeded before accounts existed (any local one) get the accounts
	// on the next boot, once.
	[Fact]
	public async Task SeedAsync_AddsAccountsToAnAlreadySeededDatabase()
	{
		await using var dbContext = await SeededDatabaseAsync();
		await dbContext.Accounts.ExecuteDeleteAsync(_cancellationToken);
		var casesBefore = await dbContext.EmergencyCases.CountAsync(_cancellationToken);

		dbContext.ChangeTracker.Clear();
		await DbSeeder.SeedAsync(dbContext);
		dbContext.ChangeTracker.Clear();
		await DbSeeder.SeedAsync(dbContext);

		Assert.Equal(2, await dbContext.Accounts.CountAsync(_cancellationToken));
		Assert.Equal(casesBefore, await dbContext.EmergencyCases.CountAsync(_cancellationToken));
	}

	// A database seeded before owners existed has cases but neither demo person.
	// Skipping the accounts there left the locked board with nobody to sign in.
	[Fact]
	public async Task SeedAsync_CreatesMissingDemoPeopleForTheAccounts()
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(await factory.Postgres.CreateDatabaseAsync());
		await dbContext.Database.MigrateAsync(_cancellationToken);
		dbContext.EmergencyCases.Add(TestData.Case(TestData.Patient()));
		await dbContext.SaveChangesAsync(_cancellationToken);

		dbContext.ChangeTracker.Clear();
		await DbSeeder.SeedAsync(dbContext);
		dbContext.ChangeTracker.Clear();
		await DbSeeder.SeedAsync(dbContext);

		var accounts = await dbContext.Accounts
			.Include(account => account.StaffMember)
			.Include(account => account.Owner)
			.ToListAsync(_cancellationToken);
		Assert.Equal(2, accounts.Count);
		var team = Assert.Single(accounts, account => account.Kind == AccountKind.TeamMember);
		Assert.Equal(("Jordan", "Lee", StaffRole.Veterinarian), (team.StaffMember!.FirstName, team.StaffMember.LastName, team.StaffMember.Role));
		var parent = Assert.Single(accounts, account => account.Kind == AccountKind.PetParent);
		Assert.Equal(("Morgan", "Hale"), (parent.Owner!.FirstName, parent.Owner.LastName));
		Assert.EndsWith("@example.com", parent.Owner.Email);
		Assert.Equal(1, await dbContext.StaffMembers.CountAsync(staff => staff.FirstName == "Jordan" && staff.LastName == "Lee", _cancellationToken));
	}

	// Databases seeded before owners existed have the seeded Buddy with no owner
	// (AddOwners added Patient.OwnerId without a backfill).
	[Fact]
	public async Task SeedAsync_LinksTheOwnerlessBuddyToMorganHale()
	{
		await using var dbContext = await MigratedDatabaseAsync();
		var buddy = OwnerlessBuddy();
		var buddysCase = TestData.Case(buddy);
		dbContext.EmergencyCases.Add(buddysCase);
		await dbContext.SaveChangesAsync(_cancellationToken);

		await SeedTwiceAsync(dbContext);

		Assert.Equal(await DemoPetParentOwnerIdAsync(dbContext), await OwnerOfAsync(dbContext, buddy.Id));
		Assert.Equal(1, await dbContext.Patients.CountAsync(patient => patient.Name == "Buddy", _cancellationToken));
		Assert.Null((await dbContext.EmergencyCases.SingleAsync(c => c.Id == buddysCase.Id, _cancellationToken)).DischargedAt);
	}

	[Fact]
	public async Task SeedAsync_CreatesBuddyForMorganHaleWhenNoneIsFree()
	{
		await using var dbContext = await MigratedDatabaseAsync();
		dbContext.EmergencyCases.Add(TestData.Case(TestData.Patient()));
		await dbContext.SaveChangesAsync(_cancellationToken);

		await SeedTwiceAsync(dbContext);

		var ownerId = await DemoPetParentOwnerIdAsync(dbContext);
		var pets = await dbContext.Patients.Where(patient => patient.OwnerId == ownerId).ToListAsync(_cancellationToken);
		var pet = Assert.Single(pets);
		Assert.Equal(("Buddy", "Dog"), (pet.Name, pet.Species));
	}

	// The state S.18b left behind: Morgan Hale and the accounts exist, he has no
	// pets, and the old ownerless Buddy is still there.
	[Fact]
	public async Task SeedAsync_MendsAMorganHaleCreatedWithoutPets()
	{
		await using var dbContext = await MigratedDatabaseAsync();
		var buddy = OwnerlessBuddy();
		dbContext.EmergencyCases.Add(TestData.Case(buddy));
		var morganHale = new Owner { FirstName = "Morgan", LastName = "Hale" };
		var account = new Account
		{
			Kind = AccountKind.PetParent,
			Owner = morganHale,
			Email = "parent@vetiflow.demo"
		};
		dbContext.Accounts.Add(account);
		await dbContext.SaveChangesAsync(_cancellationToken);

		await SeedTwiceAsync(dbContext);

		Assert.Equal(morganHale.Id, await OwnerOfAsync(dbContext, buddy.Id));
	}

	[Fact]
	public async Task SeedAsync_NeverRelinksAnOwnedBuddy()
	{
		await using var dbContext = await MigratedDatabaseAsync();
		var otherOwner = TestData.Owner();
		var ownedBuddy = OwnerlessBuddy();
		ownedBuddy.Owner = otherOwner;
		dbContext.EmergencyCases.Add(TestData.Case(ownedBuddy));
		await dbContext.SaveChangesAsync(_cancellationToken);

		await SeedTwiceAsync(dbContext);

		Assert.Equal(otherOwner.Id, await OwnerOfAsync(dbContext, ownedBuddy.Id));
	}

	// A demo database seeded weeks ago showed waits of about 1,190 hours
	// (blueprint/history/fixes/2026-10-28-demo-case-times.md).
	[Fact]
	public async Task SeedAsync_BringsStaleDemoTimesForward()
	{
		await using var dbContext = await SeededDatabaseAsync();
		await MoveCaseTimesAsync(dbContext, TimeSpan.FromDays(-50));
		var before = await CaseTimesAsync(dbContext);

		await SeedTwiceAsync(dbContext);

		var newestActiveArrival = await dbContext.EmergencyCases
			.Where(emergencyCase => emergencyCase.DischargedAt == null)
			.MaxAsync(emergencyCase => emergencyCase.ArrivalTime, _cancellationToken);
		var age = DateTimeOffset.UtcNow - newestActiveArrival;
		Assert.InRange(age, TimeSpan.FromMinutes(17), TimeSpan.FromMinutes(19));
		AssertAllMovedBySameAmount(before, await CaseTimesAsync(dbContext));
	}

	[Fact]
	public async Task SeedAsync_LeavesRecentCaseTimesAlone()
	{
		await using var dbContext = await SeededDatabaseAsync();
		await MoveCaseTimesAsync(dbContext, TimeSpan.FromHours(-2));
		var before = await CaseTimesAsync(dbContext);

		await SeedTwiceAsync(dbContext);

		Assert.Equal(before, await CaseTimesAsync(dbContext));
	}

	[Fact]
	public async Task SeedAsync_MovesDischargedCaseTimesWithTheRest()
	{
		await using var dbContext = await SeededDatabaseAsync();
		var max = await dbContext.EmergencyCases.SingleAsync(emergencyCase => emergencyCase.Patient.Name == "Max", _cancellationToken);
		max.DischargedAt = max.ArrivalTime.AddMinutes(30);
		await dbContext.SaveChangesAsync(_cancellationToken);
		await MoveCaseTimesAsync(dbContext, TimeSpan.FromDays(-50));
		var before = await CaseTimesAsync(dbContext);

		await SeedTwiceAsync(dbContext);

		var after = await CaseTimesAsync(dbContext);
		Assert.Contains(after.Keys, key => key.StartsWith("case.discharged:"));
		AssertAllMovedBySameAmount(before, after);
		Assert.NotEqual(before.Values.First(), after.Values.First());
	}

	// Moves every case-related time, as weeks passing would.
	private async Task MoveCaseTimesAsync(VetiFlowDbContext dbContext, TimeSpan by)
	{
		await dbContext.EmergencyCases.ExecuteUpdateAsync(setters => setters
			.SetProperty(emergencyCase => emergencyCase.ArrivalTime, emergencyCase => emergencyCase.ArrivalTime + by)
			.SetProperty(emergencyCase => emergencyCase.LastUpdated, emergencyCase => emergencyCase.LastUpdated + by)
			.SetProperty(emergencyCase => emergencyCase.LastOwnerUpdateAt, emergencyCase => emergencyCase.LastOwnerUpdateAt + by)
			.SetProperty(emergencyCase => emergencyCase.DischargedAt, emergencyCase => emergencyCase.DischargedAt + by), _cancellationToken);
		await dbContext.CaseTasks.ExecuteUpdateAsync(setters => setters
			.SetProperty(task => task.CreatedAt, task => task.CreatedAt + by)
			.SetProperty(task => task.DueAt, task => task.DueAt + by), _cancellationToken);
		await dbContext.VitalsRecords.ExecuteUpdateAsync(setters => setters
			.SetProperty(vitals => vitals.RecordedAt, vitals => vitals.RecordedAt + by), _cancellationToken);
		await dbContext.TriageAssessments.ExecuteUpdateAsync(setters => setters
			.SetProperty(triage => triage.AssessedAt, triage => triage.AssessedAt + by), _cancellationToken);
		await dbContext.CaseEvents.ExecuteUpdateAsync(setters => setters
			.SetProperty(caseEvent => caseEvent.CreatedAt, caseEvent => caseEvent.CreatedAt + by), _cancellationToken);
		dbContext.ChangeTracker.Clear();
	}

	// Every stored case-related time, keyed by what and which row.
	private async Task<Dictionary<string, DateTimeOffset>> CaseTimesAsync(VetiFlowDbContext dbContext)
	{
		var times = new Dictionary<string, DateTimeOffset>();

		foreach (var emergencyCase in await dbContext.EmergencyCases.AsNoTracking().ToListAsync(_cancellationToken))
		{
			times[$"case.arrival:{emergencyCase.Id}"] = emergencyCase.ArrivalTime;
			times[$"case.updated:{emergencyCase.Id}"] = emergencyCase.LastUpdated;
			if (emergencyCase.LastOwnerUpdateAt is { } ownerUpdate) times[$"case.owner:{emergencyCase.Id}"] = ownerUpdate;
			if (emergencyCase.DischargedAt is { } discharged) times[$"case.discharged:{emergencyCase.Id}"] = discharged;
		}

		foreach (var task in await dbContext.CaseTasks.AsNoTracking().ToListAsync(_cancellationToken))
		{
			times[$"task.created:{task.Id}"] = task.CreatedAt;
			if (task.DueAt is { } due) times[$"task.due:{task.Id}"] = due;
		}

		foreach (var vitals in await dbContext.VitalsRecords.AsNoTracking().ToListAsync(_cancellationToken))
		{
			times[$"vitals:{vitals.Id}"] = vitals.RecordedAt;
		}

		foreach (var triage in await dbContext.TriageAssessments.AsNoTracking().ToListAsync(_cancellationToken))
		{
			times[$"triage:{triage.Id}"] = triage.AssessedAt;
		}

		foreach (var caseEvent in await dbContext.CaseEvents.AsNoTracking().ToListAsync(_cancellationToken))
		{
			times[$"event:{caseEvent.Id}"] = caseEvent.CreatedAt;
		}

		return times;
	}

	private static void AssertAllMovedBySameAmount(
		Dictionary<string, DateTimeOffset> before,
		Dictionary<string, DateTimeOffset> after)
	{
		Assert.Equal(before.Keys.Order(), after.Keys.Order());
		var shifts = before.Keys.Select(key => after[key] - before[key]).Distinct().ToList();
		var shift = Assert.Single(shifts);
		Assert.True(shift > TimeSpan.FromDays(49), $"Times should move forward by about 50 days, moved {shift}.");
	}

	private async Task<VetiFlowDbContext> MigratedDatabaseAsync()
	{
		var dbContext = VetiFlowApiFactory.CreateDbContext(await factory.Postgres.CreateDatabaseAsync());
		await dbContext.Database.MigrateAsync(_cancellationToken);
		return dbContext;
	}

	private static Patient OwnerlessBuddy()
	{
		var buddy = TestData.Patient();
		buddy.Name = "Buddy";
		buddy.Species = "Dog";
		return buddy;
	}

	private static async Task SeedTwiceAsync(VetiFlowDbContext dbContext)
	{
		dbContext.ChangeTracker.Clear();
		await DbSeeder.SeedAsync(dbContext);
		dbContext.ChangeTracker.Clear();
		await DbSeeder.SeedAsync(dbContext);
		dbContext.ChangeTracker.Clear();
	}

	private Task<Guid?> DemoPetParentOwnerIdAsync(VetiFlowDbContext dbContext) =>
		dbContext.Accounts
			.Where(account => account.Email == "parent@vetiflow.demo")
			.Select(account => account.OwnerId)
			.SingleAsync(_cancellationToken);

	private Task<Guid?> OwnerOfAsync(VetiFlowDbContext dbContext, Guid patientId) =>
		dbContext.Patients
			.Where(patient => patient.Id == patientId)
			.Select(patient => patient.OwnerId)
			.SingleAsync(_cancellationToken);

	private async Task<VetiFlowDbContext> SeededDatabaseAsync()
	{
		var dbContext = VetiFlowApiFactory.CreateDbContext(await factory.Postgres.CreateDatabaseAsync());
		await dbContext.Database.MigrateAsync(_cancellationToken);
		await DbSeeder.SeedAsync(dbContext);
		return dbContext;
	}
}
