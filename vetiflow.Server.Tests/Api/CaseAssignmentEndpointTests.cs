using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// The attending veterinarian, primary technician and room of a case (build plan
// 4.3a). Each change is written to the timeline with the actor; a room holds at
// most one active case.
public class CaseAssignmentEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task SetVeterinarian_SignedOut_Returns401()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = factory.CreateClient();

		var response = await PutAsync(client, emergencyCase.Id, "veterinarian", null);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Fact]
	public async Task SetVeterinarian_PetParent_Returns403()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PutAsync(client, emergencyCase.Id, "veterinarian", null);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
	}

	[Fact]
	public async Task SetVeterinarian_UnknownCase_Returns404()
	{
		var vet = await SaveStaffAsync(StaffRole.Veterinarian);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, Guid.NewGuid(), "veterinarian", vet.Id);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	[Fact]
	public async Task SetVeterinarian_DischargedCase_Returns409()
	{
		var vet = await SaveStaffAsync(StaffRole.Veterinarian);
		var emergencyCase = await SaveCaseAsync(dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "veterinarian", vet.Id);

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).AssignedDoctorId);
	}

	[Fact]
	public async Task SetVeterinarian_TechnicianOrInactiveStaff_Returns400()
	{
		var technician = await SaveStaffAsync(StaffRole.Technician);
		var inactiveVet = await SaveStaffAsync(StaffRole.Veterinarian, isActive: false);
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var asTechnician = await PutAsync(client, emergencyCase.Id, "veterinarian", technician.Id);
		var asInactive = await PutAsync(client, emergencyCase.Id, "veterinarian", inactiveVet.Id);

		Assert.Equal(HttpStatusCode.BadRequest, asTechnician.StatusCode);
		Assert.Equal(HttpStatusCode.BadRequest, asInactive.StatusCode);
		var problem = await asTechnician.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.True(problem.GetProperty("errors").TryGetProperty("id", out _), problem.GetRawText());
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).AssignedDoctorId);
	}

	[Fact]
	public async Task SetVeterinarian_SavesItAndWritesTheTimelineWithTheActor()
	{
		var vet = await SaveStaffAsync(StaffRole.Veterinarian, "Avery", "Chen");
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PutAsync(client, emergencyCase.Id, "veterinarian", vet.Id);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(vet.Id, saved.AssignedDoctorId);
		Assert.InRange(saved.LastUpdated, before, DateTimeOffset.UtcNow);
		var entry = Assert.Single(await EntriesAsync(emergencyCase.Id, CaseEventType.Assigned));
		Assert.Equal("Attending veterinarian: Dr. Avery Chen", entry.Description);
		Assert.Equal(await TeamStaffMemberIdAsync(), entry.CreatedByStaffId);
		Assert.InRange(entry.CreatedAt, before, DateTimeOffset.UtcNow);

		var detail = await client.GetFromJsonAsync<JsonElement>($"/api/cases/{emergencyCase.Id}", _cancellationToken);
		Assert.Equal(vet.Id, detail.GetProperty("assignedDoctor").GetProperty("id").GetGuid());
	}

	[Fact]
	public async Task SetVeterinarian_Null_ClearsItAndWritesRemoved()
	{
		var vet = await SaveStaffAsync(StaffRole.Veterinarian);
		var emergencyCase = await SaveCaseAsync(doctor: vet);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "veterinarian", null);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).AssignedDoctorId);
		Assert.Equal(["Attending veterinarian removed"], await DescriptionsAsync(emergencyCase.Id, CaseEventType.Assigned));
	}

	[Fact]
	public async Task SetVeterinarian_SameValue_WritesNoEvent()
	{
		var vet = await SaveStaffAsync(StaffRole.Veterinarian);
		var emergencyCase = await SaveCaseAsync(doctor: vet);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "veterinarian", vet.Id);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.Empty(await EntriesAsync(emergencyCase.Id, CaseEventType.Assigned));
	}

	[Fact]
	public async Task SetTechnician_VeterinarianStaff_Returns400()
	{
		var vet = await SaveStaffAsync(StaffRole.Veterinarian);
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "technician", vet.Id);

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).AssignedTechnicianId);
	}

	[Fact]
	public async Task SetTechnician_SavesItAndLeavesTheVeterinarianAlone()
	{
		var vet = await SaveStaffAsync(StaffRole.Veterinarian);
		var technician = await SaveStaffAsync(StaffRole.Technician, "Sam", "Ortiz");
		var emergencyCase = await SaveCaseAsync(doctor: vet);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "technician", technician.Id);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(technician.Id, saved.AssignedTechnicianId);
		Assert.Equal(vet.Id, saved.AssignedDoctorId);
		Assert.Equal(["Technician: Sam Ortiz"], await DescriptionsAsync(emergencyCase.Id, CaseEventType.Assigned));
	}

	[Fact]
	public async Task SetRoom_UnknownRoom_Returns400()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "room", Guid.NewGuid());

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
	}

	[Fact]
	public async Task SetRoom_RoomHeldByAnotherActiveCase_Returns409NamingThatCase()
	{
		var room = TestData.Room();
		var occupant = await SaveCaseAsync(room: room);
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "room", room.Id);

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal("This room is in use", problem.GetProperty("title").GetString());
		Assert.Equal(occupant.Id, problem.GetProperty("occupyingCaseId").GetGuid());
		Assert.Equal($"ER-{occupant.CaseNumber}", problem.GetProperty("occupyingCaseNumber").GetString());
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).RoomId);
		Assert.Empty(await EntriesAsync(emergencyCase.Id, CaseEventType.RoomChanged));
	}

	[Fact]
	public async Task SetRoom_RoomOfADischargedCase_Succeeds()
	{
		var room = TestData.Room();
		await SaveCaseAsync(room: room, dischargedAt: DateTimeOffset.UtcNow);
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "room", room.Id);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.Equal(room.Id, (await LoadCaseAsync(emergencyCase.Id)).RoomId);
	}

	[Fact]
	public async Task SetRoom_MovesTheCaseAndWritesFromAndTo()
	{
		var from = TestData.Room();
		var to = TestData.Room();
		await SaveRoomAsync(to);
		var emergencyCase = await SaveCaseAsync(room: from);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "room", to.Id);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.Equal(to.Id, (await LoadCaseAsync(emergencyCase.Id)).RoomId);
		var entry = Assert.Single(await EntriesAsync(emergencyCase.Id, CaseEventType.RoomChanged));
		Assert.Equal($"Room: {from.Name} → {to.Name}", entry.Description);
		Assert.Equal(await TeamStaffMemberIdAsync(), entry.CreatedByStaffId);
	}

	[Fact]
	public async Task SetRoom_Null_ClearsIt()
	{
		var room = TestData.Room();
		var emergencyCase = await SaveCaseAsync(room: room);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutAsync(client, emergencyCase.Id, "room", null);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).RoomId);
		Assert.Equal(["Room cleared"], await DescriptionsAsync(emergencyCase.Id, CaseEventType.RoomChanged));
	}

	[Fact]
	public async Task SetRoom_TwoCasesRaceForOneRoom_OneSucceedsAndOneGets409()
	{
		var room = TestData.Room();
		await SaveRoomAsync(room);
		var first = await SaveCaseAsync();
		var second = await SaveCaseAsync();
		using var firstClient = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		using var secondClient = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var responses = await Task.WhenAll(
			PutAsync(firstClient, first.Id, "room", room.Id),
			PutAsync(secondClient, second.Id, "room", room.Id));

		var statuses = responses.Select(response => response.StatusCode).Order().ToList();
		Assert.Equal([HttpStatusCode.NoContent, HttpStatusCode.Conflict], statuses);
		await using var dbContext = factory.CreateDbContext();
		Assert.Equal(1, await dbContext.EmergencyCases.CountAsync(emergencyCase => emergencyCase.RoomId == room.Id, _cancellationToken));
	}

	private Task<HttpResponseMessage> PutAsync(HttpClient client, Guid caseId, string field, Guid? id) =>
		client.PutAsJsonAsync($"/api/cases/{caseId}/{field}", new { id }, _cancellationToken);

	private async Task<StaffMember> SaveStaffAsync(
		StaffRole role,
		string firstName = "Staff",
		string? lastName = null,
		bool isActive = true)
	{
		var staffMember = TestData.StaffMember(role);
		staffMember.FirstName = firstName;
		staffMember.LastName = lastName ?? staffMember.LastName;
		staffMember.IsActive = isActive;
		await using var dbContext = factory.CreateDbContext();
		dbContext.StaffMembers.Add(staffMember);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return staffMember;
	}

	private async Task SaveRoomAsync(Room room)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.Rooms.Add(room);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private async Task<EmergencyCase> SaveCaseAsync(
		StaffMember? doctor = null,
		Room? room = null,
		DateTimeOffset? dischargedAt = null)
	{
		var emergencyCase = TestData.Case(TestData.Patient(), room);
		emergencyCase.AssignedDoctorId = doctor?.Id;
		emergencyCase.DischargedAt = dischargedAt;
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	private async Task<EmergencyCase> LoadCaseAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases.SingleAsync(emergencyCase => emergencyCase.Id == caseId, _cancellationToken);
	}

	private async Task<List<CaseEvent>> EntriesAsync(Guid caseId, CaseEventType type)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.CaseEvents
			.Where(caseEvent => caseEvent.EmergencyCaseId == caseId && caseEvent.Type == type)
			.OrderBy(caseEvent => caseEvent.CreatedAt)
			.ToListAsync(_cancellationToken);
	}

	private async Task<List<string>> DescriptionsAsync(Guid caseId, CaseEventType type) =>
		(await EntriesAsync(caseId, type)).Select(caseEvent => caseEvent.Description).ToList();

	private async Task<Guid?> TeamStaffMemberIdAsync()
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.Accounts
			.Where(account => account.Email == DemoAccounts.TeamEmail)
			.Select(account => account.StaffMemberId)
			.SingleAsync(_cancellationToken);
	}
}
