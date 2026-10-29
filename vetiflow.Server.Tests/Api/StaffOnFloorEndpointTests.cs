using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// GET /api/staff/on-floor (build plan 2.21a) lists every clinician who is not
// Unavailable, so these tests use their own database, and each starts with
// every staff member Unavailable and no active cases.
public class StaffOnFloorEndpointTests(VetiFlowApiFactory factory) : IAsyncLifetime
{
	private const string Route = "/api/staff/on-floor";

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

		await using var dbContext = VetiFlowApiFactory.CreateDbContext(_connectionString);
		await dbContext.StaffMembers.ExecuteUpdateAsync(
			setters => setters.SetProperty(staff => staff.Status, StaffStatus.Unavailable),
			_cancellationToken);
		await dbContext.EmergencyCases
			.Where(emergencyCase => emergencyCase.DischargedAt == null)
			.ExecuteUpdateAsync(
				setters => setters.SetProperty(emergencyCase => emergencyCase.DischargedAt, DateTimeOffset.UtcNow),
				_cancellationToken);
	}

	public async ValueTask DisposeAsync() => await _host.DisposeAsync();

	[Fact]
	public async Task GetOnFloor_ListsCliniciansNotUnavailable()
	{
		var available = Staff("Avery", "Adams", StaffRole.Veterinarian, StaffStatus.Available);
		var busy = Staff("Blair", "Brown", StaffRole.Technician, StaffStatus.Busy);
		var atLimit = Staff("Casey", "Cole", StaffRole.Technician, StaffStatus.AtLimit);
		var unavailable = Staff("Drew", "Dunn", StaffRole.Veterinarian, StaffStatus.Unavailable);
		await SaveAsync(available, busy, atLimit, unavailable);

		var clinicians = await GetOnFloorAsync();

		Assert.Equal(
			["Dr. Avery Adams/veterinarian/available", "Blair Brown/technician/busy", "Casey Cole/technician/atLimit"],
			clinicians.Select(clinician => string.Join(
				"/",
				clinician.GetProperty("displayName").GetString(),
				clinician.GetProperty("role").GetString(),
				clinician.GetProperty("status").GetString())));
		Assert.Equal(available.Id, clinicians[0].GetProperty("id").GetGuid());
		Assert.Equal("AA", clinicians[0].GetProperty("initials").GetString());
	}

	[Fact]
	public async Task GetOnFloor_LeavesOutOtherRolesAndInactiveStaff()
	{
		var inactive = Staff("Avery", "Adams", StaffRole.Veterinarian, StaffStatus.Available);
		inactive.IsActive = false;
		await SaveAsync(
			inactive,
			Staff("Blair", "Brown", StaffRole.Assistant, StaffStatus.Available),
			Staff("Casey", "Cole", StaffRole.Receptionist, StaffStatus.Busy),
			Staff("Drew", "Dunn", StaffRole.Manager, StaffStatus.Available));

		Assert.Empty(await GetOnFloorAsync());
	}

	[Fact]
	public async Task GetOnFloor_CountsActiveCasesAsDoctorOrTechnician()
	{
		var vet = Staff("Avery", "Adams", StaffRole.Veterinarian, StaffStatus.Busy);
		var tech = Staff("Blair", "Brown", StaffRole.Technician, StaffStatus.Busy);
		await SaveAsync(vet, tech);
		var asDoctor = TestData.Case(TestData.Patient());
		asDoctor.AssignedDoctorId = vet.Id;
		var asBoth = TestData.Case(TestData.Patient());
		asBoth.AssignedDoctorId = vet.Id;
		asBoth.AssignedTechnicianId = tech.Id;
		var discharged = TestData.Case(TestData.Patient());
		discharged.AssignedDoctorId = vet.Id;
		discharged.DischargedAt = DateTimeOffset.UtcNow;
		await using (var dbContext = VetiFlowApiFactory.CreateDbContext(_connectionString))
		{
			dbContext.EmergencyCases.AddRange(asDoctor, asBoth, discharged);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}

		var clinicians = await GetOnFloorAsync();

		Assert.Equal([2, 1], clinicians.Select(clinician => clinician.GetProperty("activeCaseCount").GetInt32()));
	}

	[Fact]
	public async Task GetOnFloor_OrdersByLastNameThenFirstName()
	{
		await SaveAsync(
			Staff("Casey", "Brown", StaffRole.Technician, StaffStatus.Busy),
			Staff("Avery", "Cole", StaffRole.Technician, StaffStatus.Busy),
			Staff("Blair", "Brown", StaffRole.Technician, StaffStatus.Busy));

		var clinicians = await GetOnFloorAsync();

		Assert.Equal(
			["Blair Brown", "Casey Brown", "Avery Cole"],
			clinicians.Select(clinician => clinician.GetProperty("displayName").GetString()));
	}

	[Fact]
	public async Task GetOnFloor_NobodyOnFloor_ReturnsEmptyList()
	{
		Assert.Empty(await GetOnFloorAsync());
	}

	[Fact]
	public async Task GetOnFloor_SignedOut_Returns401()
	{
		using var client = _host.CreateClient();

		AssertProblemStatus(await client.GetAsync(Route, _cancellationToken), HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task GetOnFloor_AsPetParent_Returns403()
	{
		using var client = await _host.CreateClient().SignInAsync(DemoAccounts.ParentEmail);

		AssertProblemStatus(await client.GetAsync(Route, _cancellationToken), HttpStatusCode.Forbidden);
	}

	private static StaffMember Staff(string firstName, string lastName, StaffRole role, StaffStatus status) => new()
	{
		FirstName = firstName,
		LastName = lastName,
		Role = role,
		Status = status
	};

	private async Task SaveAsync(params StaffMember[] staffMembers)
	{
		await using var dbContext = VetiFlowApiFactory.CreateDbContext(_connectionString);
		dbContext.StaffMembers.AddRange(staffMembers);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	// As the demo team member, who is Unavailable here, so never in the list.
	private async Task<List<JsonElement>> GetOnFloorAsync()
	{
		using var client = await _host.CreateClient().SignInAsync(DemoAccounts.TeamEmail);

		var response = await client.GetAsync(Route, _cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		return await response.Content.ReadFromJsonAsync<List<JsonElement>>(_cancellationToken) ?? [];
	}

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}
}
