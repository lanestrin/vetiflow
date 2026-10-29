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

// Tasks, blockers and due items on a case (build plan 4.4a): add, complete and
// reopen, with who did it and when.
public class CaseTasksEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task CreateTask_SavesOpenTaskWithCreator_Returns201()
	{
		var emergencyCase = await SaveCaseAsync();
		var assignee = await SaveStaffAsync();
		var dueAt = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.AddMinutes(15).ToUnixTimeSeconds());
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PostTaskAsync(client, emergencyCase.Id, new
		{
			type = "reassessment",
			description = "  Recheck pain score  ",
			dueAt,
			assignedToStaffId = assignee.Id
		});

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var body = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal("reassessment", body.GetProperty("type").GetString());
		Assert.Equal("open", body.GetProperty("status").GetString());
		Assert.Equal("Recheck pain score", body.GetProperty("description").GetString());
		Assert.Equal(assignee.Id, body.GetProperty("assignedTo").GetProperty("id").GetGuid());
		Assert.Equal("Jordan Lee", body.GetProperty("createdBy").GetProperty("name").GetString());

		var saved = await LoadTaskAsync(body.GetProperty("id").GetGuid());
		Assert.Equal(emergencyCase.Id, saved.EmergencyCaseId);
		Assert.Equal(CaseTaskType.Reassessment, saved.Type);
		Assert.Equal(CaseTaskStatus.Open, saved.Status);
		Assert.Equal(dueAt, saved.DueAt);
		Assert.Equal(assignee.Id, saved.AssignedToStaffId);
		Assert.Equal("Jordan", saved.CreatedByStaff?.FirstName);
		Assert.InRange(saved.CreatedAt, before, DateTimeOffset.UtcNow);
		Assert.InRange((await LoadCaseAsync(emergencyCase.Id)).LastUpdated, before, DateTimeOffset.UtcNow);
	}

	[Theory]
	[InlineData("reassessment")]
	[InlineData("clientUpdate")]
	public async Task CreateTask_Reassessment_WithoutDueAt_Returns400(string type)
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTaskAsync(client, emergencyCase.Id, new { type, description = "Call owner" });

		await AssertFieldErrorAsync(response, "DueAt");
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).Tasks);
	}

	[Theory]
	[InlineData("""{ "type": "chore", "description": "Walk" }""")]
	[InlineData("""{ "type": 1, "description": "Walk" }""")]
	[InlineData("""{ "description": "Walk" }""")]
	public async Task CreateTask_UnknownType_Returns400(string json)
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsync(
			$"/api/cases/{emergencyCase.Id}/tasks",
			new StringContent(json, Encoding.UTF8, "application/json"),
			_cancellationToken);

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).Tasks);
	}

	[Fact]
	public async Task CreateTask_BlankOrLongDescription_Returns400()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		await AssertFieldErrorAsync(await PostTaskAsync(client, emergencyCase.Id, new { type = "task", description = "   " }), "Description");
		await AssertFieldErrorAsync(
			await PostTaskAsync(client, emergencyCase.Id, new { type = "task", description = new string('x', 201) }),
			"Description");
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).Tasks);
	}

	[Fact]
	public async Task CreateTask_UnknownOrInactiveAssignee_Returns400()
	{
		var emergencyCase = await SaveCaseAsync();
		var inactive = await SaveStaffAsync(isActive: false);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		foreach (var assigneeId in new[] { Guid.NewGuid(), inactive.Id })
		{
			var response = await PostTaskAsync(client, emergencyCase.Id, new { type = "task", description = "Place IV", assignedToStaffId = assigneeId });
			await AssertFieldErrorAsync(response, "AssignedToStaffId");
		}
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).Tasks);
	}

	[Fact]
	public async Task CreateTask_UnknownCase_Returns404()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTaskAsync(client, Guid.NewGuid(), new { type = "task", description = "Place IV" });

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task CreateTask_DischargedCase_Returns409()
	{
		var emergencyCase = await SaveCaseAsync(dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTaskAsync(client, emergencyCase.Id, new { type = "task", description = "Place IV" });

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).Tasks);
	}

	[Fact]
	public async Task CreateTask_SendsCaseUpdated()
	{
		var emergencyCase = await SaveCaseAsync();
		await using var hub = await ConnectHubAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTaskAsync(client, emergencyCase.Id, new { type = "blocker", description = "Awaiting owner consent" });

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		await hub.AssertNotifiedAsync(emergencyCase.Id, _cancellationToken);
	}

	[Fact]
	public async Task CreateTask_SignedOut_Returns401()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = factory.CreateClient();

		var response = await PostTaskAsync(client, emergencyCase.Id, new { type = "task", description = "Place IV" });

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task CreateTask_AsPetParent_Returns403()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PostTaskAsync(client, emergencyCase.Id, new { type = "task", description = "Place IV" });

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
		Assert.Empty((await LoadCaseAsync(emergencyCase.Id)).Tasks);
	}

	[Fact]
	public async Task CompleteTask_SetsDoneWithResolver()
	{
		var (emergencyCase, task) = await SaveCaseWithTaskAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PostActionAsync(client, emergencyCase.Id, task.Id, "complete");

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadTaskAsync(task.Id);
		Assert.Equal(CaseTaskStatus.Done, saved.Status);
		Assert.Equal("Jordan", saved.ResolvedByStaff?.FirstName);
		Assert.InRange(saved.ResolvedAt!.Value, before, DateTimeOffset.UtcNow);
		Assert.InRange((await LoadCaseAsync(emergencyCase.Id)).LastUpdated, before, DateTimeOffset.UtcNow);
	}

	[Fact]
	public async Task CompleteTask_AlreadyDone_ChangesNothing()
	{
		var resolvedAt = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.AddMinutes(-10).ToUnixTimeSeconds());
		var (emergencyCase, task) = await SaveCaseWithTaskAsync(CaseTaskStatus.Done, resolvedAt);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostActionAsync(client, emergencyCase.Id, task.Id, "complete");

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadTaskAsync(task.Id);
		Assert.Equal(CaseTaskStatus.Done, saved.Status);
		Assert.Equal(resolvedAt, saved.ResolvedAt);
		Assert.Null(saved.ResolvedByStaffId);
	}

	[Fact]
	public async Task ReopenTask_ClearsResolver()
	{
		var (emergencyCase, task) = await SaveCaseWithTaskAsync(CaseTaskStatus.Done, DateTimeOffset.UtcNow.AddMinutes(-10));
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostActionAsync(client, emergencyCase.Id, task.Id, "reopen");

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadTaskAsync(task.Id);
		Assert.Equal(CaseTaskStatus.Open, saved.Status);
		Assert.Null(saved.ResolvedAt);
		Assert.Null(saved.ResolvedByStaffId);
	}

	[Theory]
	[InlineData("complete")]
	[InlineData("reopen")]
	public async Task CompleteTask_Cancelled_Returns409(string action)
	{
		var (emergencyCase, task) = await SaveCaseWithTaskAsync(CaseTaskStatus.Cancelled);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostActionAsync(client, emergencyCase.Id, task.Id, action);

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Equal(CaseTaskStatus.Cancelled, (await LoadTaskAsync(task.Id)).Status);
	}

	[Fact]
	public async Task CompleteTask_OtherCasesTask_Returns404()
	{
		var (_, task) = await SaveCaseWithTaskAsync();
		var otherCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostActionAsync(client, otherCase.Id, task.Id, "complete");

		AssertProblemStatus(response, HttpStatusCode.NotFound);
		Assert.Equal(CaseTaskStatus.Open, (await LoadTaskAsync(task.Id)).Status);
	}

	[Fact]
	public async Task CompleteTask_DischargedCase_Returns409()
	{
		var (emergencyCase, task) = await SaveCaseWithTaskAsync(dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostActionAsync(client, emergencyCase.Id, task.Id, "complete");

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Equal(CaseTaskStatus.Open, (await LoadTaskAsync(task.Id)).Status);
	}

	[Fact]
	public async Task CompleteTask_SendsCaseUpdated()
	{
		var (emergencyCase, task) = await SaveCaseWithTaskAsync();
		await using var hub = await ConnectHubAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostActionAsync(client, emergencyCase.Id, task.Id, "complete");

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		await hub.AssertNotifiedAsync(emergencyCase.Id, _cancellationToken);
	}

	[Fact]
	public async Task CompleteTask_AsPetParent_Returns403()
	{
		var (emergencyCase, task) = await SaveCaseWithTaskAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PostActionAsync(client, emergencyCase.Id, task.Id, "complete");

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
		Assert.Equal(CaseTaskStatus.Open, (await LoadTaskAsync(task.Id)).Status);
	}

	private Task<HttpResponseMessage> PostTaskAsync(HttpClient client, Guid caseId, object body) =>
		client.PostAsJsonAsync($"/api/cases/{caseId}/tasks", body, _cancellationToken);

	private Task<HttpResponseMessage> PostActionAsync(HttpClient client, Guid caseId, Guid taskId, string action) =>
		client.PostAsync($"/api/cases/{caseId}/tasks/{taskId}/{action}", null, _cancellationToken);

	private async Task<EmergencyCase> SaveCaseAsync(DateTimeOffset? dischargedAt = null)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.DischargedAt = dischargedAt;
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	private async Task<(EmergencyCase Case, CaseTask Task)> SaveCaseWithTaskAsync(
		CaseTaskStatus status = CaseTaskStatus.Open,
		DateTimeOffset? resolvedAt = null,
		DateTimeOffset? dischargedAt = null)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.DischargedAt = dischargedAt;
		var task = new CaseTask { Description = "Review radiographs", Status = status, ResolvedAt = resolvedAt };
		emergencyCase.Tasks.Add(task);
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return (emergencyCase, task);
	}

	private async Task<StaffMember> SaveStaffAsync(bool isActive = true)
	{
		var staffMember = TestData.StaffMember(StaffRole.Technician);
		staffMember.IsActive = isActive;
		await using var dbContext = factory.CreateDbContext();
		dbContext.StaffMembers.Add(staffMember);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return staffMember;
	}

	private async Task<CaseTask> LoadTaskAsync(Guid taskId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.CaseTasks
			.Include(task => task.CreatedByStaff)
			.Include(task => task.ResolvedByStaff)
			.SingleAsync(task => task.Id == taskId, _cancellationToken);
	}

	private async Task<EmergencyCase> LoadCaseAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases
			.Include(emergencyCase => emergencyCase.Tasks)
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
	}
}
