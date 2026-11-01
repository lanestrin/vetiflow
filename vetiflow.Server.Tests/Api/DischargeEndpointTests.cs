using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Moving a case to the Discharge stage through Update status (build plan 4.21a):
// it records the discharge time, takes the case off the board, and refuses the
// clinical writes a discharged case no longer takes.
public class DischargeEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task MoveToDischarge_RecordsTheTimeAndTakesTheCaseOffTheBoard()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Treatment);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStatusAsync(client, emergencyCase.Id, "discharge", "completed");

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadAsync(emergencyCase.Id);
		Assert.NotNull(saved.DischargedAt);
		Assert.DoesNotContain(emergencyCase.Id, await BoardIdsAsync(client));
		using var detail = await client.GetAsync($"/api/cases/{emergencyCase.Id}", _cancellationToken);
		Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
		var json = await detail.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.NotEqual(JsonValueKind.Null, json.GetProperty("dischargedAt").ValueKind);
	}

	[Fact]
	public async Task MoveToDischarge_WritesStageChangedAndDischargedWithTheActor()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Treatment);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		await PatchStatusAsync(client, emergencyCase.Id, "discharge", "completed");

		var saved = await LoadWithEventsAsync(emergencyCase.Id);
		var stageChanged = Assert.Single(saved.Events, e => e.Type == CaseEventType.StageChanged);
		Assert.Equal("Stage changed: Treatment to Discharge", stageChanged.Description);
		var discharged = Assert.Single(saved.Events, e => e.Type == CaseEventType.Discharged);
		Assert.Equal("Discharged", discharged.Description);
		Assert.Equal("Jordan", discharged.CreatedByStaff?.FirstName);
	}

	[Fact]
	public async Task StatusChangeOnADischargedCase_Returns409AndKeepsTheFirstDischargeTime()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Treatment);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PatchStatusAsync(client, emergencyCase.Id, "discharge", "completed");
		var first = await LoadWithEventsAsync(emergencyCase.Id);

		var response = await PatchStatusAsync(client, emergencyCase.Id, "discharge", "waiting");

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		var saved = await LoadWithEventsAsync(emergencyCase.Id);
		Assert.Equal(first.DischargedAt, saved.DischargedAt);
		Assert.Equal(first.Events.Count, saved.Events.Count);
	}

	[Fact]
	public async Task DischargedCase_TakesNoTriageTaskOrVitals()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Treatment);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PatchStatusAsync(client, emergencyCase.Id, "discharge", "completed");

		var triage = await client.PostAsJsonAsync($"/api/cases/{emergencyCase.Id}/triage", new { priority = "critical" }, _cancellationToken);
		var task = await client.PostAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/tasks",
			new { type = "task", description = "Check the wound" },
			_cancellationToken);
		var vitals = await client.PostAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/vitals",
			new { heartRate = 100 },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.Conflict, triage.StatusCode);
		Assert.Equal(HttpStatusCode.Conflict, task.StatusCode);
		Assert.Equal(HttpStatusCode.Conflict, vitals.StatusCode);
	}

	private async Task<HttpResponseMessage> PatchStatusAsync(HttpClient client, Guid caseId, string stage, string status) =>
		await client.PatchAsJsonAsync(
			$"/api/cases/{caseId}/status",
			new { stage, status, nextAction = (string?)null },
			_cancellationToken);

	private async Task<HashSet<Guid>> BoardIdsAsync(HttpClient client)
	{
		var response = await client.GetAsync("/api/cases", _cancellationToken);
		var cases = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		return cases.EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ToHashSet();
	}

	// A case at the given stage, with a room so the test can see the room free up.
	private async Task<EmergencyCase> SaveCaseAsync(CaseStage stage)
	{
		var emergencyCase = TestData.Case(TestData.Patient(), TestData.Room());
		emergencyCase.Stage = stage;
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	private async Task<EmergencyCase> LoadAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases.SingleAsync(c => c.Id == caseId, _cancellationToken);
	}

	private async Task<EmergencyCase> LoadWithEventsAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases
			.Include(c => c.Events).ThenInclude(e => e.CreatedByStaff)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
	}
}
