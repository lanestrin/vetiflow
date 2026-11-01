using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// GET /api/staff/team (build plan 4.5). The database is shared with other tests,
// so these assert only on the staff and cases each test saves.
public class StaffTeamEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task GetTeam_SignedOut_Returns401()
	{
		using var client = factory.CreateClient();

		var response = await client.GetAsync("/api/staff/team", _cancellationToken);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Fact]
	public async Task GetTeam_PetParent_Returns403()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await client.GetAsync("/api/staff/team", _cancellationToken);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
	}

	[Fact]
	public async Task GetTeam_ListsTheFloorBeforeUnavailableCliniciansEachByName()
	{
		var unavailable = Staff(StaffRole.Veterinarian, StaffStatus.Unavailable, "Aaron", "Unavailable");
		var onFloor = Staff(StaffRole.Technician, StaffStatus.Busy, "Zoe", "Floor");
		await SaveStaffAsync(unavailable, onFloor);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var team = await GetTeamAsync(client);

		var ids = team.EnumerateArray().Select(clinician => clinician.GetProperty("id").GetGuid()).ToList();
		Assert.True(ids.IndexOf(onFloor.Id) < ids.IndexOf(unavailable.Id));
		var listed = Find(team, unavailable.Id);
		Assert.Equal("Dr. Aaron Unavailable", listed.GetProperty("displayName").GetString());
		Assert.Equal("unavailable", listed.GetProperty("status").GetString());
	}

	[Fact]
	public async Task GetTeam_LeavesOutAssistantsAndDeactivatedStaff()
	{
		var assistant = Staff(StaffRole.Assistant, StaffStatus.Available, "Ada", "Assistant");
		var deactivated = Staff(StaffRole.Veterinarian, StaffStatus.Available, "Dee", "Deactivated");
		deactivated.IsActive = false;
		await SaveStaffAsync(assistant, deactivated);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var team = await GetTeamAsync(client);

		var ids = team.EnumerateArray().Select(clinician => clinician.GetProperty("id").GetGuid()).ToList();
		Assert.DoesNotContain(assistant.Id, ids);
		Assert.DoesNotContain(deactivated.Id, ids);
	}

	[Fact]
	public async Task GetTeam_CountsEachActiveCaseOnceAndSkipsDischargedOnes()
	{
		var clinician = Staff(StaffRole.Veterinarian, StaffStatus.Available, "Cara", "Counted");
		var technician = Staff(StaffRole.Technician, StaffStatus.Busy, "Tom", "Helper");
		await SaveStaffAsync(clinician, technician);
		var both = await SaveCaseAsync("Milo", doctor: clinician, technician: clinician);
		var asDoctor = await SaveCaseAsync("Luna", doctor: clinician);
		var asTechnician = await SaveCaseAsync("Max", technician: clinician);
		await SaveCaseAsync("Old", doctor: clinician, dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var team = await GetTeamAsync(client);

		var listed = Find(team, clinician.Id);
		Assert.Equal(3, listed.GetProperty("activeCaseCount").GetInt32());
		var caseIds = listed.GetProperty("activeCases").EnumerateArray()
			.Select(item => item.GetProperty("id").GetGuid()).ToList();
		Assert.Equal(3, caseIds.Count);
		Assert.Contains(both.Id, caseIds);
		Assert.Contains(asDoctor.Id, caseIds);
		Assert.Contains(asTechnician.Id, caseIds);
		var milo = listed.GetProperty("activeCases").EnumerateArray()
			.Single(item => item.GetProperty("id").GetGuid() == both.Id);
		Assert.Equal("Milo", milo.GetProperty("patientName").GetString());
		Assert.StartsWith("ER-", milo.GetProperty("caseNumber").GetString());
	}

	[Fact]
	public async Task GetTeam_ClinicianWithNoCases_HasAnEmptyList()
	{
		var idle = Staff(StaffRole.Veterinarian, StaffStatus.Available, "Ina", "Idle");
		await SaveStaffAsync(idle);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var team = await GetTeamAsync(client);

		var listed = Find(team, idle.Id);
		Assert.Equal(0, listed.GetProperty("activeCaseCount").GetInt32());
		Assert.Equal(0, listed.GetProperty("activeCases").GetArrayLength());
	}

	private async Task<JsonElement> GetTeamAsync(HttpClient client)
	{
		var response = await client.GetAsync("/api/staff/team", _cancellationToken);
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		return await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
	}

	private static JsonElement Find(JsonElement team, Guid id) =>
		team.EnumerateArray().Single(clinician => clinician.GetProperty("id").GetGuid() == id);

	private static StaffMember Staff(StaffRole role, StaffStatus status, string firstName, string lastName)
	{
		var staffMember = TestData.StaffMember(role);
		staffMember.FirstName = firstName;
		staffMember.LastName = lastName;
		staffMember.Status = status;
		return staffMember;
	}

	private async Task SaveStaffAsync(params StaffMember[] staff)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.StaffMembers.AddRange(staff);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private async Task<EmergencyCase> SaveCaseAsync(
		string patientName,
		StaffMember? doctor = null,
		StaffMember? technician = null,
		DateTimeOffset? dischargedAt = null)
	{
		var patient = TestData.Patient();
		patient.Name = patientName;
		var emergencyCase = TestData.Case(patient);
		emergencyCase.AssignedDoctorId = doctor?.Id;
		emergencyCase.AssignedTechnicianId = technician?.Id;
		emergencyCase.DischargedAt = dischargedAt;

		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}
}
