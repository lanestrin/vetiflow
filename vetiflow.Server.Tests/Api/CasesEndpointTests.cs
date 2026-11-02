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
	public async Task UpdateStatus_SignedOut_Returns401AndLeavesCaseAlone()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = factory.CreateClient();

		var response = await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"treatment","status":"inProgress"}""");

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
		await AssertStageAsync(emergencyCase.Id, CaseStage.Incoming);
	}

	[Fact]
	public async Task UpdateStatus_AsPetParent_Returns403AndLeavesCaseAlone()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"treatment","status":"inProgress"}""");

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
	// belong in it. The owner's name does, as on the prototype's cards (2.11a).
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
	}

	// Free-text tags were removed (build plan 3.5c): no tags field, no tags endpoint.
	[Fact]
	public async Task Tags_AreGoneFromCasesAndCannotBeAdded()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);
		var detail = await client.GetFromJsonAsync<JsonElement>($"/api/cases/{emergencyCase.Id}", _cancellationToken);
		var add = await client.PostAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/tags", new { text = "O2 support", tone = "caution" }, _cancellationToken);

		var item = Assert.Single(cases!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		Assert.False(item.TryGetProperty("tags", out _));
		Assert.False(detail.TryGetProperty("tags", out _));
		Assert.Equal(HttpStatusCode.NotFound, add.StatusCode);
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
	public async Task UpdateStatus_MovesCaseAndTouchesLastUpdated()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Triage;
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow.AddHours(-1);
		emergencyCase.StageEnteredAt = DateTimeOffset.UtcNow.AddHours(-1);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/status",
			new { stage = "treatment", status = "inProgress" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
		Assert.Equal(CaseStage.Treatment, saved.Stage);
		Assert.True(saved.LastUpdated > emergencyCase.LastUpdated);
		Assert.True(saved.StageEnteredAt > emergencyCase.StageEnteredAt);
	}

	[Fact]
	public async Task UpdateStatus_UnknownCase_ReturnsNotFound()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{Guid.NewGuid()}/status",
			new { stage = "treatment", status = "inProgress" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	// Only a known stage name may move a case: not a number, not a missing value.
	[Theory]
	[InlineData("""{"stage":"surgery","status":"waiting"}""")]
	[InlineData("""{"stage":2,"status":"waiting"}""")]
	[InlineData("""{"stage":"2","status":"waiting"}""")]
	[InlineData("""{"stage":99,"status":"waiting"}""")]
	[InlineData("""{"stage":"triage,treatment","status":"waiting"}""")]
	[InlineData("""{"stage":null,"status":"waiting"}""")]
	[InlineData("""{}""")]
	public async Task UpdateStatus_InvalidStage_ReturnsBadRequestAndLeavesCaseAlone(string body)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStatusAsync(client, emergencyCase.Id, body);

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
		Assert.Equal(CaseStage.Incoming, saved.Stage);
	}

	[Fact]
	public async Task UpdateStatus_InvalidStage_DoesNotExposeTypeNames()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"surgery","status":"waiting"}""");

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		var problem = await response.Content.ReadAsStringAsync(_cancellationToken);
		Assert.Contains("stage", problem, StringComparison.OrdinalIgnoreCase);
		Assert.DoesNotContain("vetiflow.Server", problem);
	}

	[Fact]
	public async Task UpdateStatus_NotifiesConnectedBoards()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Triage;
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
			$"/api/cases/{emergencyCase.Id}/status",
			new { stage = "diagnostics", status = "waiting" },
			_cancellationToken);

		await notified.Task.WaitAsync(TimeSpan.FromSeconds(10), _cancellationToken);
	}

	[Fact]
	public async Task UpdateStatus_SetsStageStatusAndNextActionTogether()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Triage;
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStatusAsync(
			client,
			emergencyCase.Id,
			"""{"stage":"treatment","status":"inProgress","nextAction":"Start fluids"}""");

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
		Assert.Equal(CaseStage.Treatment, saved.Stage);
		Assert.Equal(CaseStatus.InProgress, saved.Status);
		Assert.Equal("Start fluids", saved.NextAction);
	}

	[Fact]
	public async Task UpdateStatus_RefusedStageMove_Returns409AndLeavesCaseAlone()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"treatment","status":"inProgress"}""");

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		await AssertStageAsync(emergencyCase.Id, CaseStage.Incoming);
	}

	[Fact]
	public async Task UpdateStatus_CompletedOutsideDischarge_Returns409()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Triage;
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"treatment","status":"completed"}""");

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.SingleAsync(c => c.Id == emergencyCase.Id, _cancellationToken);
		Assert.Equal(CaseStage.Triage, saved.Stage);
		Assert.Equal(CaseStatus.Unassigned, saved.Status);
	}

	[Fact]
	public async Task UpdateStatus_RecordsStageAndStatusEventsWithTheActor()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Triage;
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"treatment","status":"inProgress"}""");

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadWithEventsAsync(emergencyCase.Id);
		Assert.Equal(2, saved.Events.Count);
		var stageChanged = Assert.Single(saved.Events, e => e.Type == CaseEventType.StageChanged);
		Assert.Equal("Stage changed: Triage to Treatment", stageChanged.Description);
		Assert.Equal("Jordan", stageChanged.CreatedByStaff?.FirstName);
		var statusChanged = Assert.Single(saved.Events, e => e.Type == CaseEventType.StatusChanged);
		Assert.Equal("Status changed: Unassigned to InProgress", statusChanged.Description);
		Assert.Equal("Jordan", statusChanged.CreatedByStaff?.FirstName);
	}

	[Fact]
	public async Task UpdateStatus_StatusOnly_RecordsOnlyAStatusEvent()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Triage;
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"triage","status":"waiting"}""");

		var saved = await LoadWithEventsAsync(emergencyCase.Id);
		var statusChanged = Assert.Single(saved.Events);
		Assert.Equal(CaseEventType.StatusChanged, statusChanged.Type);
		Assert.Equal(CaseStage.Triage, saved.Stage);
	}

	[Fact]
	public async Task UpdateStatus_NextActionOnly_RecordsNoEvent()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Stage = CaseStage.Triage;
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		await PatchStatusAsync(client, emergencyCase.Id, """{"stage":"triage","status":"unassigned","nextAction":"Recheck pain"}""");

		var saved = await LoadWithEventsAsync(emergencyCase.Id);
		Assert.Empty(saved.Events);
		Assert.Equal("Recheck pain", saved.NextAction);
	}

	[Fact]
	public async Task StageRoute_IsRemoved()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PatchAsync(
			$"/api/cases/{Guid.NewGuid()}/stage",
			new StringContent("""{"stage":"treatment"}""", System.Text.Encoding.UTF8, "application/json"),
			_cancellationToken);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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
	public async Task GetCase_ReturnsVitalsSpO2()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.RecordVitals(new VitalsRecord { SpO2 = 91 });
		emergencyCase.RecordVitals(new VitalsRecord { HeartRate = 100, RecordedAt = DateTimeOffset.UtcNow.AddMinutes(-10) });
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		var vitals = detail.GetProperty("vitals").EnumerateArray().ToList();
		Assert.Equal(91, vitals[0].GetProperty("spO2").GetInt32());
		Assert.Equal(JsonValueKind.Null, vitals[1].GetProperty("spO2").ValueKind);
	}

	[Fact]
	public async Task GetCase_VitalsListOutOfRangeReadings()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.RecordVitals(new VitalsRecord { HeartRate = 148, TemperatureF = 102.0m, SpO2 = 91 });
		emergencyCase.RecordVitals(new VitalsRecord { HeartRate = 100, RecordedAt = DateTimeOffset.UtcNow.AddMinutes(-10) });
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		var vitals = detail.GetProperty("vitals").EnumerateArray().ToList();
		Assert.Equal(
			["heartRate", "spO2"],
			vitals[0].GetProperty("outOfRange").EnumerateArray().Select(name => name.GetString()));
		Assert.Empty(vitals[1].GetProperty("outOfRange").EnumerateArray());
	}

	[Fact]
	public async Task GetCase_ReturnsLatestPainScore()
	{
		var technician = TestData.StaffMember(StaffRole.Technician);
		var emergencyCase = PainScoredCase(technician);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		var latest = detail.GetProperty("latestPainScore");
		Assert.Equal(6, latest.GetProperty("score").GetInt32());
		Assert.Equal("After methadone", latest.GetProperty("notes").GetString());
		AssertReference(latest.GetProperty("recordedBy"), technician.Id, $"{technician.FirstName} {technician.LastName}");
	}

	[Fact]
	public async Task GetCases_ReturnsLatestPainScoreWithoutNotes()
	{
		var emergencyCase = PainScoredCase(TestData.StaffMember(StaffRole.Technician));
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var item = await GetBoardItemAsync(client, emergencyCase.Id);

		var latest = item.GetProperty("latestPainScore");
		Assert.Equal(6, latest.GetProperty("score").GetInt32());
		Assert.Equal(["score", "occurredAt", "recordedAt"], latest.EnumerateObject().Select(property => property.Name));
		Assert.Equal(JsonValueKind.Null, latest.GetProperty("occurredAt").ValueKind);
	}

	[Fact]
	public async Task GetCase_NoPainScore_ReturnsNull()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);
		var item = await GetBoardItemAsync(client, emergencyCase.Id);

		Assert.Equal(JsonValueKind.Null, detail.GetProperty("latestPainScore").ValueKind);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("latestPainScore").ValueKind);
	}

	// An older 8 then a newer 6.
	private static EmergencyCase PainScoredCase(StaffMember recorder)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		var now = DateTimeOffset.UtcNow;
		emergencyCase.RecordPainScore(new PainScore { Score = 8, Notes = "On arrival", RecordedAt = now.AddMinutes(-30) });
		emergencyCase.RecordPainScore(new PainScore
		{
			Score = 6,
			Notes = "After methadone",
			RecordedAt = now.AddMinutes(-5),
			RecordedByStaff = recorder
		});
		return emergencyCase;
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

	// The panel's "Next reassessment" and "Client update" rows (4.4a).
	[Fact]
	public async Task GetCase_ReturnsNextOpenReassessmentAndClientUpdate()
	{
		var emergencyCase = DueItemsCase(out var nextReassessment, out var nextClientUpdate, out var assignee);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		AssertDueItem(detail.GetProperty("nextReassessment"), nextReassessment, assignee);
		Assert.Equal(nextClientUpdate.Id, detail.GetProperty("nextClientUpdate").GetProperty("id").GetGuid());
		Assert.Equal(JsonValueKind.Null, detail.GetProperty("nextClientUpdate").GetProperty("assignedTo").ValueKind);
	}

	[Fact]
	public async Task GetCase_NoDueItems_ReturnsNulls()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Tasks.Add(TestData.Task());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		Assert.Equal(JsonValueKind.Null, detail.GetProperty("nextReassessment").ValueKind);
		Assert.Equal(JsonValueKind.Null, detail.GetProperty("nextClientUpdate").ValueKind);
	}

	[Fact]
	public async Task GetCases_ReturnsNextDueItems()
	{
		var emergencyCase = DueItemsCase(out var nextReassessment, out var nextClientUpdate, out var assignee);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);

		var item = Assert.Single(cases!, item => item.GetProperty("id").GetGuid() == emergencyCase.Id);
		AssertDueItem(item.GetProperty("nextReassessment"), nextReassessment, assignee);
		Assert.Equal(nextClientUpdate.Id, item.GetProperty("nextClientUpdate").GetProperty("id").GetGuid());
	}

	[Fact]
	public async Task GetCase_TaskShowsCreatorAndResolver()
	{
		var creator = TestData.StaffMember(StaffRole.Technician);
		var resolver = TestData.StaffMember(StaffRole.Veterinarian);
		var task = TestData.Task(status: CaseTaskStatus.Done);
		task.CreatedByStaff = creator;
		task.ResolvedByStaff = resolver;
		task.ResolvedAt = DateTimeOffset.UtcNow;
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Tasks.Add(task);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		var listed = Assert.Single(detail.GetProperty("tasks").EnumerateArray());
		AssertReference(listed.GetProperty("createdBy"), creator.Id, $"{creator.FirstName} {creator.LastName}");
		AssertReference(listed.GetProperty("resolvedBy"), resolver.Id, $"{resolver.FirstName} {resolver.LastName}");
	}

	// An earlier done reassessment, a later open one and a plain task due
	// sooner, so only the earliest open item of each type wins.
	private static EmergencyCase DueItemsCase(
		out CaseTask nextReassessment,
		out CaseTask nextClientUpdate,
		out StaffMember assignee)
	{
		var now = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
		assignee = TestData.StaffMember(StaffRole.Technician);
		var done = DueTask(CaseTaskType.Reassessment, now.AddMinutes(2));
		done.Status = CaseTaskStatus.Done;
		nextReassessment = DueTask(CaseTaskType.Reassessment, now.AddMinutes(8));
		nextReassessment.AssignedToStaff = assignee;
		var laterReassessment = DueTask(CaseTaskType.Reassessment, now.AddMinutes(30));
		nextClientUpdate = DueTask(CaseTaskType.ClientUpdate, now.AddMinutes(45));
		var plainTask = DueTask(CaseTaskType.Task, now.AddMinutes(1));

		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.Tasks.AddRange([laterReassessment, done, nextReassessment, nextClientUpdate, plainTask]);
		return emergencyCase;
	}

	private static CaseTask DueTask(CaseTaskType type, DateTimeOffset dueAt)
	{
		var task = TestData.Task(type);
		task.DueAt = dueAt;
		return task;
	}

	private static void AssertDueItem(JsonElement item, CaseTask expected, StaffMember assignee)
	{
		Assert.Equal(expected.Id, item.GetProperty("id").GetGuid());
		Assert.Equal(expected.Description, item.GetProperty("description").GetString());
		Assert.Equal(expected.DueAt, item.GetProperty("dueAt").GetDateTimeOffset());
		AssertReference(item.GetProperty("assignedTo"), assignee.Id, $"{assignee.FirstName} {assignee.LastName}");
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

	// Everything a patient flow card shows (build plan 2.11a).
	[Fact]
	public async Task GetCases_ReturnsCardFields()
	{
		var owner = TestData.Owner();
		var patient = TestData.Patient();
		patient.Owner = owner;
		patient.DateOfBirth = new DateOnly(2018, 4, 2);
		var room = TestData.Room();
		room.Type = RoomType.Oxygen;
		var doctor = TestData.StaffMember(StaffRole.Veterinarian);
		doctor.FirstName = "jordan";
		var emergencyCase = TestData.Case(patient, room);
		emergencyCase.AssignedDoctor = doctor;
		emergencyCase.AssignedTechnician = TestData.StaffMember(StaffRole.Technician);
		emergencyCase.RecordTriage(new TriageAssessment { Acuity = AcuityLevel.Critical });
		// Past triage, so a Critical case shows STAT rather than New.
		emergencyCase.Stage = CaseStage.Treatment;
		// A whole-second time, so the value read back from Postgres compares equal.
		emergencyCase.StageEnteredAt = new DateTimeOffset(2026, 10, 28, 10, 53, 0, TimeSpan.Zero);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var item = await GetBoardItemAsync(client, emergencyCase.Id);

		Assert.Equal("2018-04-02", item.GetProperty("patientDateOfBirth").GetString());
		Assert.Equal($"Owner {owner.LastName}", item.GetProperty("ownerName").GetString());
		Assert.Equal(room.Name, item.GetProperty("room").GetProperty("name").GetString());
		Assert.Equal("oxygen", item.GetProperty("room").GetProperty("type").GetString());
		Assert.Equal(emergencyCase.StageEnteredAt, item.GetProperty("stageEnteredAt").GetDateTimeOffset());
		Assert.Equal("stat", item.GetProperty("waitChip").GetString());
		var clinician = item.GetProperty("clinician");
		Assert.Equal(doctor.Id, clinician.GetProperty("id").GetGuid());
		Assert.Equal(doctor.LastName, clinician.GetProperty("shortName").GetString());
		Assert.Equal($"J{char.ToUpperInvariant(doctor.LastName[0])}", clinician.GetProperty("initials").GetString());
		// Staff see the owner's name, never their contact details.
		Assert.False(item.TryGetProperty("ownerPhone", out _));
		Assert.DoesNotContain(owner.Email!, item.GetRawText());
	}

	[Fact]
	public async Task GetCases_ClinicianFallsBackToTechnician()
	{
		var technician = TestData.StaffMember(StaffRole.Technician);
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.AssignedTechnician = technician;
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var item = await GetBoardItemAsync(client, emergencyCase.Id);

		Assert.Equal(technician.Id, item.GetProperty("clinician").GetProperty("id").GetGuid());
		Assert.Equal("new", item.GetProperty("waitChip").GetString());
	}

	[Fact]
	public async Task GetCases_NoOwnerOrClinician_ReturnsNulls()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var item = await GetBoardItemAsync(client, emergencyCase.Id);

		Assert.Equal(JsonValueKind.Null, item.GetProperty("patientDateOfBirth").ValueKind);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("ownerName").ValueKind);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("room").ValueKind);
		Assert.Equal(JsonValueKind.Null, item.GetProperty("clinician").ValueKind);
	}

	// The patient overview panel's data (build plan 3.2a), including what intake
	// recorded so staff can check medicines and doses on the next visit.
	[Fact]
	public async Task GetCase_ReturnsOverviewFields()
	{
		var patient = TestData.Patient();
		patient.DateOfBirth = new DateOnly(2018, 3, 1);
		patient.DateOfBirthIsEstimated = true;
		patient.Allergies = "Penicillin";
		patient.CurrentMedications = "Carprofen 75 mg twice daily";
		var room = TestData.Room();
		room.Type = RoomType.Oxygen;
		var emergencyCase = TestData.Case(patient, room);
		// Whole seconds, so the value survives Postgres's microsecond precision.
		emergencyCase.StageEnteredAt = DateTimeOffset.FromUnixTimeSeconds(1_800_000_000);
		emergencyCase.AllergiesAtIntake = "Penicillin";
		emergencyCase.MedicationsAtIntake = "Carprofen, last dose 7 AM";
		emergencyCase.TreatmentAuthorization = TreatmentAuthorization.Authorized;
		emergencyCase.ReferringClinic = "Lakeside Animal Clinic";
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);

		Assert.Equal(emergencyCase.StageEnteredAt, detail.GetProperty("stageEnteredAt").GetDateTimeOffset());
		Assert.Equal("Penicillin", detail.GetProperty("allergiesAtIntake").GetString());
		Assert.Equal("Carprofen, last dose 7 AM", detail.GetProperty("medicationsAtIntake").GetString());
		Assert.Equal("authorized", detail.GetProperty("treatmentAuthorization").GetString());
		Assert.Equal("Lakeside Animal Clinic", detail.GetProperty("referringClinic").GetString());
		var roomJson = detail.GetProperty("room");
		AssertReference(roomJson, room.Id, room.Name);
		Assert.Equal("oxygen", roomJson.GetProperty("type").GetString());
		var patientJson = detail.GetProperty("patient");
		Assert.Equal("2018-03-01", patientJson.GetProperty("dateOfBirth").GetString());
		Assert.True(patientJson.GetProperty("dateOfBirthIsEstimated").GetBoolean());
		Assert.Equal("Penicillin", patientJson.GetProperty("allergies").GetString());
		Assert.Equal("Carprofen 75 mg twice daily", patientJson.GetProperty("currentMedications").GetString());
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

	// This test's case from the board list; other tests add cases in parallel.
	[Theory]
	[InlineData(false)]
	[InlineData(true)]
	public async Task GetById_AssessmentEventTimesAreNullableAndPreserveEntryOrder(bool unknownEventTime)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		var enteredAt = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds());
		DateTimeOffset? retrospective = unknownEventTime ? null : enteredAt.AddHours(-1);
		var oldVitals = new VitalsRecord { HeartRate = 100, RecordedAt = enteredAt.AddMinutes(-1), OccurredAt = enteredAt.AddMinutes(-2) };
		var latestVitals = new VitalsRecord { HeartRate = 140, RecordedAt = enteredAt, OccurredAt = retrospective };
		emergencyCase.RecordVitals(oldVitals);
		emergencyCase.RecordVitals(latestVitals);
		var oldTriage = new TriageAssessment { Acuity = AcuityLevel.Stable, AssessedAt = enteredAt.AddMinutes(-1), OccurredAt = enteredAt.AddMinutes(-2) };
		var latestTriage = new TriageAssessment { Acuity = AcuityLevel.Urgent, AssessedAt = enteredAt, OccurredAt = retrospective };
		emergencyCase.RecordTriage(oldTriage);
		emergencyCase.RecordTriage(latestTriage);
		emergencyCase.RecordPainScore(new PainScore { Score = 1, RecordedAt = enteredAt.AddMinutes(-1), OccurredAt = enteredAt.AddMinutes(-2) });
		var latestPain = new PainScore { Score = 3, Notes = "Legacy note", RecordedAt = enteredAt, OccurredAt = retrospective };
		emergencyCase.RecordPainScore(latestPain);
		await SaveAsync(emergencyCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var detail = await GetCaseAsync(client, emergencyCase.Id);
		var vitals = detail.GetProperty("vitals").EnumerateArray().ToArray();
		var triage = detail.GetProperty("triageAssessments").EnumerateArray().ToArray();
		Assert.Equal(new[] { latestVitals.Id, oldVitals.Id }, vitals.Select(row => row.GetProperty("id").GetGuid()));
		Assert.Equal(new[] { latestTriage.Id, oldTriage.Id }, triage.Select(row => row.GetProperty("id").GetGuid()));
		var pain = detail.GetProperty("latestPainScore");
		Assert.Equal(latestPain.Id, pain.GetProperty("id").GetGuid());
		foreach (var (row, timeField, actorField) in new[]
		{
			(vitals[0], "recordedAt", "recordedBy"), (triage[0], "assessedAt", "assessedBy"), (pain, "recordedAt", "recordedBy")
		})
		{
			Assert.Equal(enteredAt, row.GetProperty(timeField).GetDateTimeOffset());
			Assert.Equal(JsonValueKind.Null, row.GetProperty(actorField).ValueKind);
			Assert.Equal(retrospective, row.GetProperty("occurredAt").ValueKind == JsonValueKind.Null
				? (DateTimeOffset?)null : row.GetProperty("occurredAt").GetDateTimeOffset());
		}
		Assert.Equal(oldVitals.OccurredAt, vitals[1].GetProperty("occurredAt").GetDateTimeOffset());
		Assert.Equal(oldTriage.OccurredAt, triage[1].GetProperty("occurredAt").GetDateTimeOffset());

		var summary = (await GetBoardItemAsync(client, emergencyCase.Id)).GetProperty("latestPainScore");
		Assert.Equal(3, summary.GetProperty("score").GetInt32());
		Assert.Equal(enteredAt, summary.GetProperty("recordedAt").GetDateTimeOffset());
		Assert.Equal(retrospective, summary.GetProperty("occurredAt").ValueKind == JsonValueKind.Null
			? (DateTimeOffset?)null : summary.GetProperty("occurredAt").GetDateTimeOffset());
		Assert.False(summary.TryGetProperty("notes", out _));
	}

	private async Task<JsonElement> GetBoardItemAsync(HttpClient client, Guid caseId)
	{
		var cases = await client.GetFromJsonAsync<JsonElement[]>("/api/cases", _cancellationToken);
		return cases!.Single(item => item.GetProperty("id").GetGuid() == caseId);
	}

	private async Task<EmergencyCase> LoadWithEventsAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases
			.Include(c => c.Events).ThenInclude(e => e.CreatedByStaff)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
	}

	private async Task<JsonElement> GetCaseAsync(HttpClient client, Guid caseId)
	{
		var response = await client.GetAsync($"/api/cases/{caseId}", _cancellationToken);
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		return await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
	}

	// Sends the body exactly as written, so tests can send numbers and nulls.
	private Task<HttpResponseMessage> PatchStatusAsync(HttpClient client, Guid caseId, string body) =>
		client.PatchAsync(
			$"/api/cases/{caseId}/status",
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
