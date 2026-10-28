using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Complete triage and re-triage (build plan 4.2a): every priority change goes
// through RecordTriage and adds a Triaged entry to the timeline.
public class CaseTriageEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Triage_IncomingCase_RecordsAssessmentAndMovesToTriage()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Incoming, AcuityLevel.Urgent);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "critical", notes = "Pale gums, CRT 3 s." });

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(AcuityLevel.Critical, saved.Acuity);
		Assert.Equal(CaseStage.Triage, saved.Stage);
		Assert.InRange(saved.StageEnteredAt, before, DateTimeOffset.UtcNow);

		var latest = saved.TriageAssessments.OrderByDescending(triage => triage.AssessedAt).First();
		Assert.Equal(2, saved.TriageAssessments.Count);
		Assert.Equal(AcuityLevel.Critical, latest.Acuity);
		Assert.Equal("Pale gums, CRT 3 s.", latest.RawIntakeNotes);
		Assert.Equal("Jordan", latest.AssessedByStaff?.FirstName);

		var triaged = Assert.Single(saved.Events, e => e.Type == CaseEventType.Triaged);
		Assert.Equal("Triage completed · Critical", triaged.Description);
		Assert.Equal("Jordan", triaged.CreatedByStaff?.FirstName);
	}

	[Fact]
	public async Task Triage_ConfirmsProvisionalPriority_RecordsConfirmation()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Incoming, AcuityLevel.Stable);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "stable" });

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(AcuityLevel.Stable, saved.Acuity);
		Assert.Equal(CaseStage.Triage, saved.Stage);
		Assert.Equal("Triage completed · Stable", Assert.Single(saved.Events).Description);
	}

	[Fact]
	public async Task Triage_LaterCase_ChangesPriorityAndKeepsStage()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Treatment, AcuityLevel.Stable);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "urgent" });

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(AcuityLevel.Urgent, saved.Acuity);
		Assert.Equal(CaseStage.Treatment, saved.Stage);
		Assert.Equal(emergencyCase.StageEnteredAt, saved.StageEnteredAt);
		Assert.Equal("Re-triaged · Stable → Urgent", Assert.Single(saved.Events).Description);
	}

	[Fact]
	public async Task Triage_SamePriorityLater_RecordsConfirmed()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Diagnostics, AcuityLevel.Urgent);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "urgent" });

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(2, saved.TriageAssessments.Count);
		Assert.Equal("Re-triaged · Urgent confirmed", Assert.Single(saved.Events).Description);
	}

	[Fact]
	public async Task Triage_MissingPriority_Returns400()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Incoming, AcuityLevel.Urgent);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTriageAsync(client, emergencyCase.Id, new { notes = "No priority" });

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.Equal(CaseStage.Incoming, (await LoadCaseAsync(emergencyCase.Id)).Stage);
	}

	[Fact]
	public async Task Triage_UnknownCase_Returns404()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTriageAsync(client, Guid.NewGuid(), new { priority = "stable" });

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	[Fact]
	public async Task Triage_DischargedCase_Returns409()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Discharge, AcuityLevel.Stable, dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "critical" });

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		Assert.Equal(AcuityLevel.Stable, (await LoadCaseAsync(emergencyCase.Id)).Acuity);
	}

	[Fact]
	public async Task Triage_SignedOut_Returns401()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Incoming, AcuityLevel.Urgent);
		using var client = factory.CreateClient();

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "critical" });

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Fact]
	public async Task Triage_PetParent_Returns403AndLeavesCaseAlone()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Incoming, AcuityLevel.Urgent);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "critical" });

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(AcuityLevel.Urgent, saved.Acuity);
		Assert.Equal(CaseStage.Incoming, saved.Stage);
	}

	[Fact]
	public async Task Triage_NotifiesConnectedBoards()
	{
		var emergencyCase = await SaveCaseAsync(CaseStage.Incoming, AcuityLevel.Urgent);
		await using var hub = new HubConnectionBuilder()
			.WithUrl(new Uri(factory.Server.BaseAddress, "hubs/cases"), options =>
			{
				options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
				options.Transports = HttpTransportType.LongPolling;
			})
			.Build();
		// Other tests notify in parallel, so collect every id and look for ours.
		var notified = new System.Collections.Concurrent.ConcurrentDictionary<Guid, bool>();
		hub.On<Guid>("caseUpdated", caseId =>
		{
			notified[caseId] = true;
		});
		await hub.StartAsync(_cancellationToken);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTriageAsync(client, emergencyCase.Id, new { priority = "stable" });

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var deadline = DateTime.UtcNow.AddSeconds(10);
		while (!notified.ContainsKey(emergencyCase.Id) && DateTime.UtcNow < deadline)
		{
			await Task.Delay(50, _cancellationToken);
		}
		Assert.True(notified.ContainsKey(emergencyCase.Id));
	}

	private Task<HttpResponseMessage> PostTriageAsync(HttpClient client, Guid caseId, object body) =>
		client.PostAsJsonAsync($"/api/cases/{caseId}/triage", body, _cancellationToken);

	// A case at the given stage whose intake recorded the given priority.
	private async Task<EmergencyCase> SaveCaseAsync(
		CaseStage stage,
		AcuityLevel acuity,
		DateTimeOffset? dischargedAt = null)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = stage;
		// Whole seconds, so the value survives Postgres's microsecond precision.
		emergencyCase.StageEnteredAt = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.AddMinutes(-20).ToUnixTimeSeconds());
		emergencyCase.DischargedAt = dischargedAt;
		emergencyCase.RecordTriage(new TriageAssessment
		{
			Acuity = acuity,
			AssessedAt = DateTimeOffset.UtcNow.AddMinutes(-30)
		});

		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	private async Task<EmergencyCase> LoadCaseAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases
			.Include(c => c.TriageAssessments).ThenInclude(t => t.AssessedByStaff)
			.Include(c => c.Events).ThenInclude(e => e.CreatedByStaff)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
	}
}
