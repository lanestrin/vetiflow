using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using vetiflow.Server.Hosting;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// GET /api/board/summary (build plan 2.12a) counts every active case, so these
// tests use their own database rather than the shared one, and each starts by
// discharging whatever is active. Tests in one class run one at a time.
public class BoardSummaryEndpointTests(VetiFlowApiFactory factory) : IAsyncLifetime
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;
	private string _connectionString = "";
	private WebApplicationFactory<Program> _host = null!;

	public async ValueTask InitializeAsync()
	{
		_connectionString = await factory.Postgres.CreateDatabaseAsync();
		_host = TestHosts.Create(
			_connectionString,
			migrateOnStartup: true,
			seedDemoData: true,
			settings: new Dictionary<string, string> { ["DemoSignIn:Enabled"] = "true" });
		_ = _host.Server;
		await DischargeEveryActiveCaseAsync();
	}

	public async ValueTask DisposeAsync() => await _host.DisposeAsync();

	[Fact]
	public async Task GetSummary_SignedOut_Returns401()
	{
		using var client = _host.CreateClient();

		var response = await client.GetAsync("/api/board/summary", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task GetSummary_AsPetParent_Returns403()
	{
		using var client = await _host.CreateClient().SignInAsync(DemoAccounts.ParentEmail);

		var response = await client.GetAsync("/api/board/summary", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
	}

	[Fact]
	public async Task GetSummary_CountsActiveCasesOnly()
	{
		var discharged = TestData.Case(TestData.Patient());
		discharged.DischargedAt = DateTimeOffset.UtcNow;
		await AddAsync(TestData.Case(TestData.Patient()), TestData.Case(TestData.Patient()), discharged);

		var summary = await GetSummaryAsync();

		Assert.Equal(2, summary.GetProperty("patientsInCare").GetInt32());
	}

	[Fact]
	public async Task GetSummary_CountsArrivalsSinceTheShiftBegan()
	{
		var now = DateTimeOffset.UtcNow;
		var shift = _host.Services.GetRequiredService<ClinicShifts>().At(now);
		await AddAsync(
			ArrivedAt(shift.StartedAt.AddMinutes(-1)),
			ArrivedAt(shift.StartedAt),
			ArrivedAt(shift.StartedAt + (now - shift.StartedAt) / 2));

		var summary = await GetSummaryAsync();

		Assert.Equal(3, summary.GetProperty("patientsInCare").GetInt32());
		Assert.Equal(2, summary.GetProperty("arrivedThisShift").GetInt32());
		var reportedShift = summary.GetProperty("shift");
		Assert.Equal(shift.Name == ShiftName.Day ? "day" : "night", reportedShift.GetProperty("name").GetString());
		Assert.Equal(shift.StartedAt, reportedShift.GetProperty("startedAt").GetDateTimeOffset());
	}

	[Fact]
	public async Task GetSummary_AwaitingTriage_CountsIncomingAndOldestArrival()
	{
		var oldest = DateTimeOffset.UtcNow.AddMinutes(-18);
		var triaged = ArrivedAt(oldest.AddMinutes(-30));
		triaged.Stage = CaseStage.Treatment;
		await AddAsync(ArrivedAt(oldest), ArrivedAt(oldest.AddMinutes(10)), triaged);

		var summary = await GetSummaryAsync();

		Assert.Equal(2, summary.GetProperty("awaitingTriage").GetInt32());
		var reported = summary.GetProperty("oldestAwaitingTriageArrivedAt").GetDateTimeOffset();
		Assert.True((reported - oldest).Duration() < TimeSpan.FromMilliseconds(1));
	}

	[Fact]
	public async Task GetSummary_NothingAwaitingTriage_OldestIsNull()
	{
		var triaged = TestData.Case(TestData.Patient());
		triaged.Stage = CaseStage.Treatment;
		await AddAsync(triaged);

		var summary = await GetSummaryAsync();

		Assert.Equal(0, summary.GetProperty("awaitingTriage").GetInt32());
		Assert.Equal(JsonValueKind.Null, summary.GetProperty("oldestAwaitingTriageArrivedAt").ValueKind);
	}

	// A care team is a doctor or a technician (decided 2026-10-28). An incoming
	// case with a provisional Critical priority counts: it is in the Critical lane.
	[Fact]
	public async Task GetSummary_Critical_CountsThoseWithoutDoctorOrTechnician()
	{
		var withDoctor = Critical();
		withDoctor.AssignedDoctor = TestData.StaffMember(StaffRole.Veterinarian);
		var withTechnician = Critical();
		withTechnician.AssignedTechnician = TestData.StaffMember(StaffRole.Technician);
		var provisional = Critical();
		var urgent = TestData.Case(TestData.Patient());
		urgent.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
		await AddAsync(withDoctor, withTechnician, provisional, urgent);

		var summary = await GetSummaryAsync();

		Assert.Equal(3, summary.GetProperty("criticalPatients").GetInt32());
		Assert.Equal(1, summary.GetProperty("criticalWithoutCareTeam").GetInt32());
	}

	[Fact]
	public async Task GetSummary_ReturnsClinicName()
	{
		var summary = await GetSummaryAsync();

		Assert.Equal("Northside Veterinary Emergency", summary.GetProperty("clinicName").GetString());
	}

	// The same rule as GET /api/staff/on-floor (2.21a).
	[Fact]
	public async Task GetSummary_CountsCliniciansOnFloor()
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(_connectionString);
		await dbContext.StaffMembers.ExecuteUpdateAsync(
			setters => setters.SetProperty(staff => staff.Status, StaffStatus.Unavailable),
			_cancellationToken);
		var inactive = Staff(StaffRole.Veterinarian, StaffStatus.Available);
		inactive.IsActive = false;
		dbContext.StaffMembers.AddRange(
			Staff(StaffRole.Veterinarian, StaffStatus.Available),
			Staff(StaffRole.Technician, StaffStatus.Busy),
			Staff(StaffRole.Technician, StaffStatus.AtLimit),
			Staff(StaffRole.Veterinarian, StaffStatus.Unavailable),
			Staff(StaffRole.Receptionist, StaffStatus.Available),
			inactive);
		await dbContext.SaveChangesAsync(_cancellationToken);

		var summary = await GetSummaryAsync();

		Assert.Equal(3, summary.GetProperty("cliniciansOnFloor").GetInt32());
	}

	private static StaffMember Staff(StaffRole role, StaffStatus status)
	{
		var staffMember = TestData.StaffMember(role);
		staffMember.Status = status;
		return staffMember;
	}

	private static EmergencyCase Critical()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Critical });
		return emergencyCase;
	}

	private static EmergencyCase ArrivedAt(DateTimeOffset arrival)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.ArrivalTime = arrival;
		return emergencyCase;
	}

	private async Task AddAsync(params EmergencyCase[] cases)
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(_connectionString);
		dbContext.EmergencyCases.AddRange(cases);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private async Task<JsonElement> GetSummaryAsync()
	{
		using var client = await _host.CreateClient().SignInAsync(DemoAccounts.TeamEmail);
		var response = await client.GetAsync("/api/board/summary", _cancellationToken);
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		return await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
	}

	private async Task DischargeEveryActiveCaseAsync()
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(_connectionString);
		await dbContext.EmergencyCases
			.Where(emergencyCase => emergencyCase.DischargedAt == null)
			.ExecuteUpdateAsync(
				setters => setters.SetProperty(emergencyCase => emergencyCase.DischargedAt, DateTimeOffset.UtcNow),
				_cancellationToken);
	}

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}
}
