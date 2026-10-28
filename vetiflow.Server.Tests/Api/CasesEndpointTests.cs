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

	// The board is for hospital team members only; owners never see it.
	[Fact]
	public async Task GetCases_SignedOut_Returns401Problem()
	{
		using var client = factory.CreateClient();

		var response = await client.GetAsync("/api/cases", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task GetCases_AsPetParent_Returns403Problem()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await client.GetAsync("/api/cases", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
	}

	[Fact]
	public async Task UpdateStage_SignedOut_Returns401AndLeavesCaseAlone()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var response = await PatchStageAsync(client, emergencyCase.Id, """{"stage":"treatment"}""");

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
		await AssertStageAsync(emergencyCase.Id, CaseStage.Incoming);
	}

	[Fact]
	public async Task UpdateStage_AsPetParent_Returns403AndLeavesCaseAlone()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PatchStageAsync(client, emergencyCase.Id, """{"stage":"treatment"}""");

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
		await AssertStageAsync(emergencyCase.Id, CaseStage.Incoming);
	}

	// Untriaged first (risk unknown, next step is triage), then Critical, Urgent, Stable,
	// then the longest wait. Acuity is stored as text, so this also proves the
	// query ranks it rather than sorting alphabetically.
	[Fact]
	public async Task GetCases_OrdersByAcuityThenLongestWait()
	{
		var stableNewer = CaseWith(AcuityLevel.Stable, minutesAgo: 60);
		var stableOlder = CaseWith(AcuityLevel.Stable, minutesAgo: 300);
		var urgentNewer = CaseWith(AcuityLevel.Urgent, minutesAgo: 30);
		var urgentOlder = CaseWith(AcuityLevel.Urgent, minutesAgo: 180);
		var critical = CaseWith(AcuityLevel.Critical, minutesAgo: 20);
		var untriaged = CaseWith(acuity: null, minutesAgo: 10);
		await SaveAsync(stableNewer, stableOlder, urgentNewer, urgentOlder, critical, untriaged);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		// Other tests add cases in parallel, so compare only this test's own.
		var expected = new[] { untriaged, critical, urgentOlder, urgentNewer, stableOlder, stableNewer }
			.Select(emergencyCase => emergencyCase.Id)
			.ToList();
		var actual = cases!
			.Select(item => item.GetProperty("id").GetGuid())
			.Where(expected.Contains)
			.ToList();
		Assert.Equal(expected, actual);
	}

	// Discharged patients have left the ER, so they leave the board and its counts.
	[Fact]
	public async Task GetCases_LeavesOutDischargedCases()
	{
		var active = TestData.Case(TestData.Patient());
		var discharged = TestData.Case(TestData.Patient());
		discharged.DischargedAt = DateTimeOffset.UtcNow;
		await SaveAsync(active, discharged);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var ids = cases!.Select(item => item.GetProperty("id").GetGuid()).ToList();
		Assert.Contains(active.Id, ids);
		Assert.DoesNotContain(discharged.Id, ids);
	}

	// The client depends on this exact shape, including camelCase enum names.
	[Fact]
	public async Task GetCases_ReturnsCaseInClientContractShape()
	{
		var patient = TestData.Patient();
		var room = TestData.Room();
		var doctor = TestData.StaffMember(StaffRole.Veterinarian);
		var technician = TestData.StaffMember(StaffRole.Technician);
		var blocker = TestData.Task(CaseTaskType.Blocker);
		var emergencyCase = TestData.Case(patient, room);
		emergencyCase.Stage = CaseStage.Triage;
		emergencyCase.Status = CaseStatus.ReadyForNextStep;
		emergencyCase.WeightKg = 12.5m;
		emergencyCase.NextAction = "Recheck vitals";
		emergencyCase.AssignedDoctor = doctor;
		emergencyCase.AssignedTechnician = technician;
		emergencyCase.Tasks.Add(blocker);
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

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
		Assert.Equal(JsonValueKind.String, item.GetProperty("lastUpdated").ValueKind);
		AssertReference(item.GetProperty("assignedDoctor"), doctor.Id, $"{doctor.FirstName} {doctor.LastName}");
		AssertReference(item.GetProperty("assignedTechnician"), technician.Id, $"{technician.FirstName} {technician.LastName}");
		AssertReference(item.GetProperty("room"), room.Id, room.Name);
		var listedBlocker = Assert.Single(item.GetProperty("blockers").EnumerateArray());
		Assert.Equal(blocker.Id, listedBlocker.GetProperty("id").GetGuid());
		Assert.Equal(blocker.Description, listedBlocker.GetProperty("description").GetString());
	}

	[Fact]
	public async Task GetCases_UnassignedCase_HasNullStaffAndRoomAndNoBlockers()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var item = Assert.Single(cases!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("assignedDoctor").ValueKind);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("assignedTechnician").ValueKind);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("room").ValueKind);
		Assert.Empty(item.GetProperty("blockers").EnumerateArray());
	}

	// Only what still blocks the case: not resolved blockers, not ordinary tasks.
	[Fact]
	public async Task GetCases_ListsOnlyOpenBlockers()
	{
		var openBlocker = TestData.Task(CaseTaskType.Blocker);
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Tasks.Add(openBlocker);
		emergencyCase.Tasks.Add(TestData.Task(CaseTaskType.Blocker, CaseTaskStatus.Done));
		emergencyCase.Tasks.Add(TestData.Task(CaseTaskType.Blocker, CaseTaskStatus.Cancelled));
		emergencyCase.Tasks.Add(TestData.Task(CaseTaskType.Task));
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var item = Assert.Single(cases!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		var listed = Assert.Single(item.GetProperty("blockers").EnumerateArray());
		Assert.Equal(openBlocker.Id, listed.GetProperty("id").GetGuid());
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
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

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
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

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
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

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
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{Guid.NewGuid()}/stage",
			new { stage = "treatment" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	// Only a known stage name may move a case: not a number, not a missing value.
	[Theory]
	[InlineData("""{"stage":"surgery"}""")]
	[InlineData("""{"stage":2}""")]
	[InlineData("""{"stage":"2"}""")]
	[InlineData("""{"stage":99}""")]
	[InlineData("""{"stage":"triage,treatment"}""")]
	[InlineData("""{"stage":null}""")]
	[InlineData("""{}""")]
	public async Task UpdateStage_InvalidStage_ReturnsBadRequestAndLeavesCaseAlone(string body)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStageAsync(client, emergencyCase.Id, body);

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
		Assert.Equal(CaseStage.Incoming, saved.Stage);
	}

	[Fact]
	public async Task UpdateStage_InvalidStage_DoesNotExposeTypeNames()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStageAsync(client, emergencyCase.Id, """{"stage":"surgery"}""");

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		var problem = await response.Content.ReadAsStringAsync(_cancellationToken);
		Assert.Contains("stage", problem, StringComparison.OrdinalIgnoreCase);
		Assert.DoesNotContain("vetiflow.Server", problem);
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
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		await client.PatchAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/stage",
			new { stage = "diagnostics" },
			_cancellationToken);

		await notified.Task.WaitAsync(TimeSpan.FromSeconds(10), _cancellationToken);
	}

	// The case detail drawer's data (build plan 3.1).
	[Fact]
	public async Task GetCase_ReturnsTheCaseWithPatientOwnerAndStaff()
	{
		var patient = TestData.Patient();
		patient.Owner = TestData.Owner();
		patient.Sex = PatientSex.FemaleSpayed;
		var doctor = TestData.StaffMember(StaffRole.Veterinarian);
		var room = TestData.Room();
		var emergencyCase = TestData.Case(patient, room);
		emergencyCase.AssignedDoctor = doctor;
		emergencyCase.NextAction = "Recheck abdomen";
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Urgent });
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		Assert.Equal(emergencyCase.Id, detail.GetProperty("id").GetGuid());
		var patientJson = detail.GetProperty("patient");
		Assert.Equal(patient.Name, patientJson.GetProperty("name").GetString());
		Assert.Equal("femaleSpayed", patientJson.GetProperty("sex").GetString());
		var owner = detail.GetProperty("owner");
		Assert.Equal(patient.Owner.LastName, owner.GetProperty("lastName").GetString());
		Assert.Equal(patient.Owner.Phone, owner.GetProperty("phone").GetString());
		Assert.Equal("Vomiting", detail.GetProperty("presentingComplaint").GetString());
		Assert.Equal("urgent", detail.GetProperty("acuity").GetString());
		Assert.Equal("incoming", detail.GetProperty("stage").GetString());
		Assert.Equal("Recheck abdomen", detail.GetProperty("nextAction").GetString());
		AssertReference(detail.GetProperty("assignedDoctor"), doctor.Id, $"{doctor.FirstName} {doctor.LastName}");
		AssertReference(detail.GetProperty("room"), room.Id, room.Name);
		Assert.Equal(JsonValueKind.Null, detail.GetProperty("assignedTechnician").ValueKind);
		Assert.Equal(JsonValueKind.Null, detail.GetProperty("dischargedAt").ValueKind);
	}

	[Fact]
	public async Task GetCase_PatientWithNoOwner_ReturnsNullOwner()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		Assert.Equal(JsonValueKind.Null, detail.GetProperty("owner").ValueKind);
		Assert.Empty(detail.GetProperty("triageAssessments").EnumerateArray());
		Assert.Empty(detail.GetProperty("vitals").EnumerateArray());
		Assert.Empty(detail.GetProperty("tasks").EnumerateArray());
		Assert.Empty(detail.GetProperty("timeline").EnumerateArray());
	}

	[Fact]
	public async Task GetCase_ListsTriageAndVitalsNewestFirst()
	{
		var technician = TestData.StaffMember(StaffRole.Technician);
		var emergencyCase = TestData.Case(TestData.Patient());
		var now = DateTimeOffset.UtcNow;
		emergencyCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Stable,
			RawIntakeNotes = "First look",
			AssessedAt = now.AddMinutes(-30)
		});
		emergencyCase.RecordTriage(new TriageAssessment
		{
			Acuity = AcuityLevel.Critical,
			RawIntakeNotes = "Worse",
			AssessedAt = now.AddMinutes(-5),
			AssessedByStaff = technician
		});
		emergencyCase.RecordVitals(new VitalsRecord { HeartRate = 90, RecordedAt = now.AddMinutes(-20) });
		emergencyCase.RecordVitals(new VitalsRecord
		{
			HeartRate = 140,
			TemperatureF = 103.1m,
			RecordedAt = now.AddMinutes(-2),
			RecordedByStaff = technician
		});
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		var triage = detail.GetProperty("triageAssessments").EnumerateArray().ToList();
		Assert.Equal(["critical", "stable"], triage.Select(item => item.GetProperty("acuity").GetString()));
		Assert.Equal("Worse", triage[0].GetProperty("rawIntakeNotes").GetString());
		AssertReference(triage[0].GetProperty("assessedBy"), technician.Id, $"{technician.FirstName} {technician.LastName}");
		Assert.Equal(JsonValueKind.Null, triage[1].GetProperty("assessedBy").ValueKind);
		var vitals = detail.GetProperty("vitals").EnumerateArray().ToList();
		Assert.Equal([140, 90], vitals.Select(item => item.GetProperty("heartRate").GetInt32()));
		Assert.Equal(103.1m, vitals[0].GetProperty("temperatureF").GetDecimal());
		AssertReference(vitals[0].GetProperty("recordedBy"), technician.Id, $"{technician.FirstName} {technician.LastName}");
	}

	[Fact]
	public async Task GetCase_ListsOpenTasksFirst()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		var now = DateTimeOffset.UtcNow;
		var oldDone = TestData.Task(status: CaseTaskStatus.Done);
		oldDone.CreatedAt = now.AddMinutes(-50);
		oldDone.ResolvedAt = now.AddMinutes(-40);
		var olderOpen = TestData.Task(CaseTaskType.Blocker);
		olderOpen.CreatedAt = now.AddMinutes(-30);
		var newerOpen = TestData.Task();
		newerOpen.CreatedAt = now.AddMinutes(-10);
		emergencyCase.Tasks.AddRange([newerOpen, oldDone, olderOpen]);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		var tasks = detail.GetProperty("tasks").EnumerateArray().ToList();
		Assert.Equal([olderOpen.Id, newerOpen.Id, oldDone.Id], tasks.Select(task => task.GetProperty("id").GetGuid()));
		Assert.Equal("blocker", tasks[0].GetProperty("type").GetString());
		Assert.Equal("done", tasks[2].GetProperty("status").GetString());
		Assert.NotEqual(JsonValueKind.Null, tasks[2].GetProperty("resolvedAt").ValueKind);
	}

	[Fact]
	public async Task GetCase_ListsTimelineOldestFirst()
	{
		var doctor = TestData.StaffMember(StaffRole.Veterinarian);
		var emergencyCase = TestData.Case(TestData.Patient());
		var now = DateTimeOffset.UtcNow;
		emergencyCase.Events.AddRange([
			new CaseEvent { Type = CaseEventType.Triaged, Description = "Triaged", CreatedAt = now.AddMinutes(-20), CreatedByStaff = doctor },
			new CaseEvent { Type = CaseEventType.Arrived, Description = "Arrived", CreatedAt = now.AddMinutes(-40) }
		]);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		var timeline = detail.GetProperty("timeline").EnumerateArray().ToList();
		Assert.Equal(["arrived", "triaged"], timeline.Select(item => item.GetProperty("type").GetString()));
		Assert.Equal(JsonValueKind.Null, timeline[0].GetProperty("createdBy").ValueKind);
		AssertReference(timeline[1].GetProperty("createdBy"), doctor.Id, $"{doctor.FirstName} {doctor.LastName}");
	}

	[Fact]
	public async Task GetCase_ReturnsADischargedCase()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.DischargedAt = DateTimeOffset.UtcNow;
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		Assert.NotEqual(JsonValueKind.Null, detail.GetProperty("dischargedAt").ValueKind);
	}

	// Case numbers (build plan 3.4a): the database assigns them; the API
	// shows them as "ER-<number>".
	[Fact]
	public async Task GetCases_ReturnsCaseNumber()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var item = cases!.Single(item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		Assert.True(emergencyCase.CaseNumber > 0);
		Assert.Equal($"ER-{emergencyCase.CaseNumber}", item.GetProperty("caseNumber").GetString());
	}

	[Fact]
	public async Task GetCase_ReturnsCaseNumber()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		Assert.Equal($"ER-{emergencyCase.CaseNumber}", detail.GetProperty("caseNumber").GetString());
	}

	[Fact]
	public async Task GetCase_Unknown_ReturnsNotFound()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.GetAsync($"/api/cases/{Guid.NewGuid()}", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task GetCase_SignedOut_Returns401()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var response = await client.GetAsync($"/api/cases/{emergencyCase.Id}", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task GetCase_PetParent_Returns403()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await client.GetAsync($"/api/cases/{emergencyCase.Id}", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
	}

	private async Task<JsonElement> GetCaseAsync(HttpClient client, Guid caseId)
	{
		var response = await client.GetAsync($"/api/cases/{caseId}", _cancellationToken);
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		return await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
	}

	// Sends the body exactly as written, so tests can send numbers and nulls.
	private Task<HttpResponseMessage> PatchStageAsync(HttpClient client, Guid caseId, string body) =>
		client.PatchAsync(
			$"/api/cases/{caseId}/stage",
			new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
			_cancellationToken);

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	private async Task AssertStageAsync(Guid caseId, CaseStage expected)
	{
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(expected, saved.Stage);
	}

	private static void AssertReference(JsonElement reference, Guid id, string name)
	{
		Assert.Equal(id, reference.GetProperty("id").GetGuid());
		Assert.Equal(name, reference.GetProperty("name").GetString());
	}

	private static EmergencyCase CaseWith(AcuityLevel? acuity, int minutesAgo)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.ArrivalTime = DateTimeOffset.UtcNow.AddMinutes(-minutesAgo);

		if (acuity is not null)
		{
			emergencyCase.RecordTriage(new TriageAssessment { Acuity = acuity.Value });
		}

		return emergencyCase;
	}

	private async Task SaveAsync(params EmergencyCase[] cases)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.AddRange(cases);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}
}
