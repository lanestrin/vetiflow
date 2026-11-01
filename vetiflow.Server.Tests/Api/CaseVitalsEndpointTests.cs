using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Recording vitals and pain scores on a case (build plan 4.8a), with who and
// when, never changing acuity.
public class CaseVitalsEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task RecordVitals_SavesSetWithRecorder_Returns201WithOutOfRange()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PostVitalsAsync(client, emergencyCase.Id, new
		{
			heartRate = 148,
			respiratoryRate = 24,
			temperatureF = 101.2m,
			spO2 = 91,
			mucousMembraneColor = "  Pale  ",
			capillaryRefillTime = "",
			mentation = "Quiet"
		});

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var body = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal(91, body.GetProperty("spO2").GetInt32());
		Assert.Equal("Pale", body.GetProperty("mucousMembraneColor").GetString());
		Assert.Equal("Jordan Lee", body.GetProperty("recordedBy").GetProperty("name").GetString());
		Assert.Equal(
			["heartRate", "spO2"],
			body.GetProperty("outOfRange").EnumerateArray().Select(name => name.GetString()));

		var saved = Assert.Single((await LoadCaseAsync(emergencyCase.Id)).VitalsRecords);
		Assert.Equal(body.GetProperty("id").GetGuid(), saved.Id);
		Assert.Equal(148, saved.HeartRate);
		Assert.Equal(24, saved.RespiratoryRate);
		Assert.Equal(101.2m, saved.TemperatureF);
		Assert.Equal(91, saved.SpO2);
		Assert.Null(saved.CapillaryRefillTime);
		Assert.Equal("Jordan", saved.RecordedByStaff?.FirstName);
		Assert.InRange(saved.RecordedAt, before, DateTimeOffset.UtcNow);
		Assert.InRange((await LoadCaseAsync(emergencyCase.Id)).LastUpdated, before, DateTimeOffset.UtcNow);

		var detail = await client.GetFromJsonAsync<JsonElement>($"/api/cases/{emergencyCase.Id}", _cancellationToken);
		var returnedVitals = Assert.Single(detail.GetProperty("vitals").EnumerateArray());
		Assert.Equal(saved.Id, returnedVitals.GetProperty("id").GetGuid());
		Assert.Equal(91, returnedVitals.GetProperty("spO2").GetInt32());
		Assert.Equal(
			["heartRate", "spO2"],
			returnedVitals.GetProperty("outOfRange").EnumerateArray().Select(name => name.GetString()));
	}

	[Fact]
	public async Task RecordVitals_LeavesAcuityUnchanged()
	{
		var emergencyCase = await SaveCaseAsync(acuity: AcuityLevel.Stable);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostVitalsAsync(client, emergencyCase.Id, new { heartRate = 220, spO2 = 80 });

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		Assert.Equal(AcuityLevel.Stable, (await LoadCaseAsync(emergencyCase.Id)).Acuity);
	}

	[Fact]
	public async Task RecordVitals_NoReadings_Returns400()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostVitalsAsync(client, emergencyCase.Id, new { mentation = "   " });

		await AssertFieldErrorAsync(response, "Readings");
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).VitalsRecords);
	}

	[Theory]
	[InlineData("HeartRate", """{ "heartRate": 0 }""")]
	[InlineData("HeartRate", """{ "heartRate": 401 }""")]
	[InlineData("RespiratoryRate", """{ "respiratoryRate": 0 }""")]
	[InlineData("RespiratoryRate", """{ "respiratoryRate": 201 }""")]
	[InlineData("TemperatureF", """{ "temperatureF": 79.9 }""")]
	[InlineData("TemperatureF", """{ "temperatureF": 115.1 }""")]
	[InlineData("SpO2", """{ "spO2": 49 }""")]
	[InlineData("SpO2", """{ "spO2": 120 }""")]
	public async Task RecordVitals_ReadingOutsidePlausibleLimits_Returns400(string field, string json)
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsync(
			$"/api/cases/{emergencyCase.Id}/vitals",
			new StringContent(json, Encoding.UTF8, "application/json"),
			_cancellationToken);

		await AssertFieldErrorAsync(response, field);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).VitalsRecords);
	}

	[Fact]
	public async Task RecordVitals_LongObservation_Returns400()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostVitalsAsync(client, emergencyCase.Id, new { heartRate = 100, mentation = new string('x', 51) });

		await AssertFieldErrorAsync(response, "Mentation");
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).VitalsRecords);
	}

	[Fact]
	public async Task RecordVitals_UnknownCase_Returns404()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostVitalsAsync(client, Guid.NewGuid(), new { heartRate = 100 });

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task RecordVitals_DischargedCase_Returns409()
	{
		var emergencyCase = await SaveCaseAsync(dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostVitalsAsync(client, emergencyCase.Id, new { heartRate = 100 });

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).VitalsRecords);
	}

	[Fact]
	public async Task RecordVitals_SendsCaseUpdated()
	{
		var emergencyCase = await SaveCaseAsync();
		await using var hub = await ConnectHubAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostVitalsAsync(client, emergencyCase.Id, new { heartRate = 100 });

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		await hub.AssertNotifiedAsync(emergencyCase.Id, _cancellationToken);
	}

	[Fact]
	public async Task RecordVitals_SignedOut_Returns401()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = factory.CreateClient();

		var response = await PostVitalsAsync(client, emergencyCase.Id, new { heartRate = 100 });

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task RecordVitals_AsPetParent_Returns403()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PostVitalsAsync(client, emergencyCase.Id, new { heartRate = 100 });

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).VitalsRecords);
	}

	[Fact]
	public async Task RecordPainScore_SavesScoreWithRecorder_Returns201()
	{
		var emergencyCase = await SaveCaseAsync(acuity: AcuityLevel.Urgent);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { score = 7, notes = "  Glasgow CMPS-SF  " });

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var body = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal(7, body.GetProperty("score").GetInt32());
		Assert.Equal("Glasgow CMPS-SF", body.GetProperty("notes").GetString());
		Assert.Equal("Jordan Lee", body.GetProperty("recordedBy").GetProperty("name").GetString());

		var loaded = await LoadCaseAsync(emergencyCase.Id);
		var saved = Assert.Single(loaded.PainScores);
		Assert.Equal(body.GetProperty("id").GetGuid(), saved.Id);
		Assert.Equal(7, saved.Score);
		Assert.Equal("Jordan", saved.RecordedByStaff?.FirstName);
		Assert.InRange(saved.RecordedAt, before, DateTimeOffset.UtcNow);
		Assert.InRange(loaded.LastUpdated, before, DateTimeOffset.UtcNow);
		Assert.Equal(AcuityLevel.Urgent, loaded.Acuity);

		var detail = await client.GetFromJsonAsync<JsonElement>($"/api/cases/{emergencyCase.Id}", _cancellationToken);
		var latest = detail.GetProperty("latestPainScore");
		Assert.Equal(saved.Id, latest.GetProperty("id").GetGuid());
		Assert.Equal(7, latest.GetProperty("score").GetInt32());
		Assert.Equal("Glasgow CMPS-SF", latest.GetProperty("notes").GetString());
		Assert.Equal(saved.RecordedByStaffId, latest.GetProperty("recordedBy").GetProperty("id").GetGuid());

		var board = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);
		var item = Assert.Single(board!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		var summary = item.GetProperty("latestPainScore");
		Assert.Equal(7, summary.GetProperty("score").GetInt32());
		Assert.Equal(["score", "occurredAt", "recordedAt"], summary.EnumerateObject().Select(property => property.Name));
		Assert.Equal(JsonValueKind.Null, summary.GetProperty("occurredAt").ValueKind);
	}

	[Theory]
	[InlineData(-1)]
	[InlineData(11)]
	public async Task RecordPainScore_ScoreOutsideZeroToTen_Returns400(int score)
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { score });

		await AssertFieldErrorAsync(response, "Score");
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).PainScores);
	}

	[Fact]
	public async Task RecordPainScore_MissingScore_Returns400()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { notes = "Restless" });

		await AssertFieldErrorAsync(response, "Score");
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).PainScores);
	}

	[Fact]
	public async Task RecordPainScore_LongNotes_Returns400()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { score = 3, notes = new string('x', 501) });

		await AssertFieldErrorAsync(response, "Notes");
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).PainScores);
	}

	[Fact]
	public async Task RecordPainScore_DischargedCase_Returns409()
	{
		var emergencyCase = await SaveCaseAsync(dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { score = 3 });

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).PainScores);
	}

	[Fact]
	public async Task RecordPainScore_SendsCaseUpdated()
	{
		var emergencyCase = await SaveCaseAsync();
		await using var hub = await ConnectHubAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { score = 3 });

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		await hub.AssertNotifiedAsync(emergencyCase.Id, _cancellationToken);
	}

	[Fact]
	public async Task RecordPainScore_UnknownCase_Returns404()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostPainScoreAsync(client, Guid.NewGuid(), new { score = 3 });

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task RecordPainScore_SignedOut_Returns401()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = factory.CreateClient();

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { score = 3 });

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).PainScores);
	}

	[Fact]
	public async Task RecordPainScore_AsPetParent_Returns403()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PostPainScoreAsync(client, emergencyCase.Id, new { score = 3 });

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).PainScores);
	}

	public static IEnumerable<object?[]> EventTimeCases()
	{
		foreach (var route in new[] { "vitals", "pain-scores", "triage" })
		{
			yield return [route, null, false, true];
			yield return [route, null, true, true];
			foreach (var value in new[] { "2020-01-02T09:30:00Z", "2020-01-02T14:30:00+05:00", "2020-01-02T04:30:00-05:00", "2020-01-02T09:30:00.1234567Z" })
			{
				yield return [route, value, true, true];
			}
			foreach (var value in new[] { "", "not-a-time", "2020-01-02", "2020-01-02T09:30:00", "2020-01-02T09:30:00+15:00", "2020-02-31T09:30:00Z", "2099-01-01T00:00:00Z" })
			{
				yield return [route, value, true, false];
			}
		}
	}

	[Theory]
	[MemberData(nameof(EventTimeCases))]
	public async Task AssessmentEventTime_ValidatesAndPreservesEntryMetadata(
		string route, string? input, bool includeTimestamp, bool valid)
	{
		var emergencyCase = await SaveCaseAsync();
		var original = await LoadCaseAsync(emergencyCase.Id);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var spoofedId = Guid.NewGuid();
		var request = new Dictionary<string, object?>
		{
			["heartRate"] = 140, ["score"] = 3, ["priority"] = "urgent",
			["recordedAt"] = "1990-01-01T00:00:00Z", ["assessedAt"] = "1990-01-01T00:00:00Z",
			["recordedByStaffId"] = spoofedId, ["assessedByStaffId"] = spoofedId,
			["performedByStaffId"] = spoofedId
		};
		if (includeTimestamp) request["occurredAt"] = input;
		var before = DateTimeOffset.UtcNow;

		var response = await client.PostAsJsonAsync($"/api/cases/{emergencyCase.Id}/{route}", request, _cancellationToken);

		var saved = await LoadCaseAsync(emergencyCase.Id);
		if (!valid)
		{
			AssertProblemStatus(response, HttpStatusCode.BadRequest);
			var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
			Assert.Contains(problem.GetProperty("errors").EnumerateObject(), error =>
				error.Name.EndsWith("occurredAt", StringComparison.OrdinalIgnoreCase));
			Assert.Empty(saved.VitalsRecords);
			Assert.Empty(saved.PainScores);
			Assert.Empty(saved.TriageAssessments);
			Assert.Empty(saved.Events);
			Assert.Equal(original.LastUpdated, saved.LastUpdated);
			Assert.Equal(original.StageEnteredAt, saved.StageEnteredAt);
			Assert.Equal(original.Stage, saved.Stage);
			Assert.Equal(original.Acuity, saved.Acuity);
			if (!string.IsNullOrEmpty(input))
			{
				Assert.DoesNotContain(input, await response.Content.ReadAsStringAsync(_cancellationToken), StringComparison.OrdinalIgnoreCase);
			}
			return;
		}

		Assert.Equal(route == "triage" ? HttpStatusCode.NoContent : HttpStatusCode.Created, response.StatusCode);
		var (occurredAt, enteredAt, recorder) = route switch
		{
			"vitals" => (Assert.Single(saved.VitalsRecords).OccurredAt, saved.VitalsRecords[0].RecordedAt, saved.VitalsRecords[0].RecordedByStaffId),
			"pain-scores" => (Assert.Single(saved.PainScores).OccurredAt, saved.PainScores[0].RecordedAt, saved.PainScores[0].RecordedByStaffId),
			_ => (Assert.Single(saved.TriageAssessments).OccurredAt, saved.TriageAssessments[0].AssessedAt, saved.TriageAssessments[0].AssessedByStaffId)
		};
		DateTimeOffset? expectedTime = input is null ? null : new DateTimeOffset(2020, 1, 2, 9, 30, 0, TimeSpan.Zero);
		if (input?.Contains('.') == true) expectedTime = expectedTime!.Value.AddTicks(1234560);
		Assert.Equal(expectedTime, occurredAt);
		if (occurredAt is not null) Assert.Equal(TimeSpan.Zero, occurredAt.Value.Offset);
		Assert.InRange(enteredAt, before, DateTimeOffset.UtcNow);
		if (route != "triage")
		{
			var body = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
			Assert.Equal(occurredAt, body.GetProperty("occurredAt").ValueKind == JsonValueKind.Null
				? (DateTimeOffset?)null : body.GetProperty("occurredAt").GetDateTimeOffset());
			// Existing entry responses carry .NET ticks; Postgres truncates below a microsecond.
			Assert.InRange(body.GetProperty("recordedAt").GetDateTimeOffset(), enteredAt, enteredAt.AddTicks(9));
		}
		await using var dbContext = factory.CreateDbContext();
		var expectedRecorder = await dbContext.Accounts.Where(account => account.Email == DemoAccounts.TeamEmail)
			.Select(account => account.StaffMemberId).SingleAsync(_cancellationToken);
		Assert.Equal(expectedRecorder, recorder);
		Assert.NotEqual(spoofedId, recorder);
		Assert.InRange(saved.LastUpdated, before, DateTimeOffset.UtcNow);
		if (route == "triage")
		{
			Assert.Equal(AcuityLevel.Urgent, saved.Acuity);
			Assert.Equal(CaseStage.Triage, saved.Stage);
			Assert.InRange(saved.StageEnteredAt, before, DateTimeOffset.UtcNow);
			Assert.Equal(enteredAt, Assert.Single(saved.Events).CreatedAt);
		}
		else
		{
			Assert.Null(saved.Acuity);
			Assert.Equal(original.Stage, saved.Stage);
			Assert.Equal(original.StageEnteredAt, saved.StageEnteredAt);
		}
	}

	[Theory]
	[InlineData("vitals")]
	[InlineData("pain-scores")]
	[InlineData("triage")]
	public async Task InvalidEventTime_DoesNotBroadcast(string route)
	{
		var emergencyCase = await SaveCaseAsync();
		var otherCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await using var listener = await ConnectHubAsync();
		var response = await client.PostAsJsonAsync($"/api/cases/{emergencyCase.Id}/{route}",
			new { heartRate = 140, score = 3, priority = "urgent", occurredAt = "2099-01-01T00:00:00Z" }, _cancellationToken);
		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.Equal(HttpStatusCode.Created, (await PostVitalsAsync(client, otherCase.Id, new { heartRate = 140 })).StatusCode);
		await listener.AssertNotifiedAsync(otherCase.Id, _cancellationToken);
		Assert.False(listener.WasNotified(emergencyCase.Id));
	}

	[Fact]
	public async Task RecordVitals_EventTimeAloneDoesNotSatisfyReadingRequirement()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var response = await PostVitalsAsync(client, emergencyCase.Id, new { occurredAt = "2020-01-02T09:30:00Z" });
		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).VitalsRecords);
	}

	private Task<HttpResponseMessage> PostPainScoreAsync(HttpClient client, Guid caseId, object body) =>
		client.PostAsJsonAsync($"/api/cases/{caseId}/pain-scores", body, _cancellationToken);

	private Task<HttpResponseMessage> PostVitalsAsync(HttpClient client, Guid caseId, object body) =>
		client.PostAsJsonAsync($"/api/cases/{caseId}/vitals", body, _cancellationToken);

	private async Task<EmergencyCase> SaveCaseAsync(AcuityLevel? acuity = null, DateTimeOffset? dischargedAt = null)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		if (acuity is { } level)
		{
			emergencyCase.RecordTriage(new TriageAssessment { Acuity = level });
		}
		emergencyCase.DischargedAt = dischargedAt;
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	private async Task<EmergencyCase> LoadCaseAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases
			.Include(emergencyCase => emergencyCase.TriageAssessments)
			.Include(emergencyCase => emergencyCase.Events)
			.Include(emergencyCase => emergencyCase.VitalsRecords)
				.ThenInclude(vitals => vitals.RecordedByStaff)
			.Include(emergencyCase => emergencyCase.PainScores)
				.ThenInclude(painScore => painScore.RecordedByStaff)
			.SingleAsync(emergencyCase => emergencyCase.Id == caseId, _cancellationToken);
	}

	private async Task<CaseHubListener> ConnectHubAsync()
	{
		var hub = new HubConnectionBuilder()
			.WithUrl(new Uri(factory.Server.BaseAddress, "hubs/cases"), options =>
			{
				options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
				options.Transports = HttpTransportType.LongPolling;
			})
			.Build();
		var listener = new CaseHubListener(hub);
		await hub.StartAsync(_cancellationToken);
		return listener;
	}

	private static async Task AssertFieldErrorAsync(HttpResponseMessage response, string field)
	{
		AssertProblemStatus(response, HttpStatusCode.BadRequest);
		var body = await response.Content.ReadFromJsonAsync<JsonElement>();
		Assert.True(body.GetProperty("errors").TryGetProperty(field, out _), $"Expected an error for {field}.");
	}

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	// Other tests notify in parallel, so it collects every id and looks for ours.
	private sealed class CaseHubListener : IAsyncDisposable
	{
		private readonly HubConnection _hub;
		private readonly ConcurrentDictionary<Guid, bool> _notified = new();

		public CaseHubListener(HubConnection hub)
		{
			_hub = hub;
			hub.On<Guid>("caseUpdated", caseId => _notified[caseId] = true);
		}

		public async Task AssertNotifiedAsync(Guid caseId, CancellationToken cancellationToken)
		{
			var deadline = DateTime.UtcNow.AddSeconds(10);
			while (!_notified.ContainsKey(caseId) && DateTime.UtcNow < deadline)
			{
				await Task.Delay(50, cancellationToken);
			}
			Assert.True(_notified.ContainsKey(caseId));
		}

		public ValueTask DisposeAsync() => _hub.DisposeAsync();

		public bool WasNotified(Guid caseId) => _notified.ContainsKey(caseId);
	}
}
