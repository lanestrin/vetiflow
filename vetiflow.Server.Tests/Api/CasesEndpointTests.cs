using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

public class CasesEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task GetCases_ReturnsNewestFirst()
	{
		var older = TestData.Case(TestData.Patient());
		older.ArrivalTime = DateTimeOffset.UtcNow.AddHours(-2);
		var newer = TestData.Case(TestData.Patient());
		newer.ArrivalTime = DateTimeOffset.UtcNow.AddHours(-1);
		await SaveAsync(older, newer);
		using var client = factory.CreateClient();

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var ids = cases!.Select(item => item.GetProperty("id").GetGuid()).ToList();
		Assert.True(
			ids.IndexOf(newer.Id) < ids.IndexOf(older.Id),
			"The newer case should be listed before the older one.");
	}

	// The client depends on this exact shape, including camelCase enum names.
	[Fact]
	public async Task GetCases_ReturnsCaseInClientContractShape()
	{
		var patient = TestData.Patient();
		var emergencyCase = TestData.Case(patient);
		emergencyCase.Stage = CaseStage.Triage;
		emergencyCase.Status = CaseStatus.ReadyForNextStep;
		emergencyCase.WeightKg = 12.5m;
		emergencyCase.NextAction = "Recheck vitals";
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var item = Assert.Single(cases!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		Assert.Equal(patient.Id, item.GetProperty("patientId").GetGuid());
		Assert.Equal(patient.Name, item.GetProperty("patientName").GetString());
		Assert.Equal("Dog", item.GetProperty("species").GetString());
		Assert.Equal("Mixed", item.GetProperty("breed").GetString());
		Assert.Equal(12.5m, item.GetProperty("weightKg").GetDecimal());
		Assert.Equal("Vomiting", item.GetProperty("presentingComplaint").GetString());
		Assert.Equal("triage", item.GetProperty("stage").GetString());
		Assert.Equal("readyForNextStep", item.GetProperty("status").GetString());
		Assert.Equal("urgent", item.GetProperty("acuity").GetString());
		Assert.Equal("Recheck vitals", item.GetProperty("nextAction").GetString());
		Assert.Equal(JsonValueKind.String, item.GetProperty("arrivalTime").ValueKind);
	}

	// The board is shown to every staff screen; owner contact details never
	// belong in it.
	[Fact]
	public async Task GetCases_DoesNotExposeOwnerDetails()
	{
		var owner = TestData.Owner();
		var patient = TestData.Patient();
		patient.Owner = owner;
		var emergencyCase = TestData.Case(patient);
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var item = Assert.Single(cases!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		var json = item.GetRawText();
		Assert.False(item.TryGetProperty("owner", out _), "The board list must not include the owner.");
		Assert.DoesNotContain(owner.Phone!, json);
		Assert.DoesNotContain(owner.Email!, json);
		Assert.DoesNotContain(owner.LastName, json);
	}

	[Fact]
	public async Task GetCases_UntriagedCase_HasNullAcuity()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var item = Assert.Single(cases!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("acuity").ValueKind);
	}

	[Fact]
	public async Task UpdateStage_MovesCaseAndTouchesLastUpdated()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow.AddHours(-1);
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/stage",
			new { stage = "treatment" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
		Assert.Equal(CaseStage.Treatment, saved.Stage);
		Assert.True(saved.LastUpdated > emergencyCase.LastUpdated);
	}

	[Fact]
	public async Task UpdateStage_UnknownCase_ReturnsNotFound()
	{
		using var client = factory.CreateClient();

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{Guid.NewGuid()}/stage",
			new { stage = "treatment" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	[Fact]
	public async Task UpdateStage_UnknownStage_ReturnsBadRequestAndLeavesCaseAlone()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/stage",
			new { stage = "surgery" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
		Assert.Equal(CaseStage.Incoming, saved.Stage);
	}

	[Fact]
	public async Task UpdateStage_NotifiesConnectedBoards()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		await using var hub = new HubConnectionBuilder()
			.WithUrl(new Uri(factory.Server.BaseAddress, "hubs/cases"), options =>
			{
				options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
				options.Transports = HttpTransportType.LongPolling;
			})
			.Build();
		var notified = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
		// Other tests update cases in parallel, so wait for this case specifically.
		hub.On<Guid>("caseUpdated", caseId =>
		{
			if (caseId == emergencyCase.Id)
			{
				notified.TrySetResult();
			}
		});
		await hub.StartAsync(_cancellationToken);
		using var client = factory.CreateClient();

		await client.PatchAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/stage",
			new { stage = "diagnostics" },
			_cancellationToken);

		await notified.Task.WaitAsync(TimeSpan.FromSeconds(10), _cancellationToken);
	}

	private async Task SaveAsync(params EmergencyCase[] cases)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.AddRange(cases);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}
}
