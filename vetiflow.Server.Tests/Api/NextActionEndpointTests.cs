using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// The Next Care Action designation (build plan 4.13a): staff designate one open
// task, and completing, cancelling or discharging clears it. Nothing else is
// ever chosen or promoted by the server.
public class NextActionEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Designate_OpenTask_SetsItWithWhoAndWhenAndWritesOneEntry()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadTaskAsync(tasks[0].Id);
		Assert.True(saved.IsNextAction);
		Assert.NotNull(saved.NextActionDesignatedByStaffId);
		Assert.InRange(saved.NextActionDesignatedAt!.Value, before, DateTimeOffset.UtcNow);
		Assert.Equal(["Next care action designated"], await NextActionEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Designate_AnotherTask_ReplacesTheEarlierOneAndWritesBothEntries()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open, CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		var response = await PutNextActionAsync(client, emergencyCase.Id, tasks[1].Id);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.False((await LoadTaskAsync(tasks[0].Id)).IsNextAction);
		Assert.True((await LoadTaskAsync(tasks[1].Id)).IsNextAction);
		Assert.Equal(
			["Next care action designated", "Next care action cleared: replaced", "Next care action designated"],
			await NextActionEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Designate_SameTaskTwice_WritesOneEntry()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		var again = await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
		Assert.Single(await NextActionEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Clear_WithNull_ClearsAndWritesOneEntry_AndNothingWhenNoneIsDesignated()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		var cleared = await PutNextActionAsync(client, emergencyCase.Id, null);
		var clearedAgain = await PutNextActionAsync(client, emergencyCase.Id, null);

		Assert.Equal(HttpStatusCode.NoContent, cleared.StatusCode);
		Assert.Equal(HttpStatusCode.NoContent, clearedAgain.StatusCode);
		Assert.False((await LoadTaskAsync(tasks[0].Id)).IsNextAction);
		Assert.Equal(
			["Next care action designated", "Next care action cleared"],
			await NextActionEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Designate_TaskOnAnotherCase_Returns404()
	{
		var (emergencyCase, _) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open);
		var (_, otherTasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutNextActionAsync(client, emergencyCase.Id, otherTasks[0].Id);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
		Assert.False((await LoadTaskAsync(otherTasks[0].Id)).IsNextAction);
	}

	[Theory]
	[InlineData(CaseTaskStatus.Done)]
	[InlineData(CaseTaskStatus.Cancelled)]
	public async Task Designate_ClosedTask_Returns409AndChangesNothing(CaseTaskStatus status)
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(status);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		Assert.False((await LoadTaskAsync(tasks[0].Id)).IsNextAction);
		Assert.Empty(await NextActionEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Designate_DischargedCase_Returns409()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open, dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		Assert.False((await LoadTaskAsync(tasks[0].Id)).IsNextAction);
	}

	[Fact]
	public async Task Designate_AsPetParent_Returns403()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
		Assert.False((await LoadTaskAsync(tasks[0].Id)).IsNextAction);
	}

	[Fact]
	public async Task CompletingTheDesignatedTask_ClearsItInTheSameSave_AndNothingIsPromoted()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open, CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		var response = await client.PostAsync($"/api/cases/{emergencyCase.Id}/tasks/{tasks[0].Id}/complete", null, _cancellationToken);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var completed = await LoadTaskAsync(tasks[0].Id);
		Assert.Equal(CaseTaskStatus.Done, completed.Status);
		Assert.False(completed.IsNextAction);
		Assert.Null(completed.NextActionDesignatedAt);
		Assert.Null(completed.NextActionDesignatedByStaffId);
		Assert.False((await LoadTaskAsync(tasks[1].Id)).IsNextAction);
		Assert.Equal(
			["Next care action designated", "Next care action cleared: task completed"],
			await NextActionEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Discharge_ClearsTheDesignation_AndNothingIsPromoted()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open, CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PutNextActionAsync(client, emergencyCase.Id, tasks[0].Id);

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{emergencyCase.Id}/status",
			new { stage = "discharge", status = "completed", nextAction = (string?)null },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.False((await LoadTaskAsync(tasks[0].Id)).IsNextAction);
		Assert.False((await LoadTaskAsync(tasks[1].Id)).IsNextAction);
		Assert.Contains("Next care action cleared: patient discharged", await NextActionEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task OpenTasks_AreNeverDesignatedAutomatically()
	{
		var (emergencyCase, tasks) = await SaveCaseWithTasksAsync(CaseTaskStatus.Open, CaseTaskStatus.Open);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		await client.PostAsync($"/api/cases/{emergencyCase.Id}/tasks/{tasks[1].Id}/complete", null, _cancellationToken);

		Assert.All(await LoadCaseTasksAsync(emergencyCase.Id), task => Assert.False(task.IsNextAction));
	}

	private Task<HttpResponseMessage> PutNextActionAsync(HttpClient client, Guid caseId, Guid? taskId) =>
		client.PutAsJsonAsync($"/api/cases/{caseId}/next-action", new { taskId }, _cancellationToken);

	private async Task<(EmergencyCase Case, List<CaseTask> Tasks)> SaveCaseWithTasksAsync(
		params CaseTaskStatus[] statuses) =>
		await SaveCaseWithTasksAsync(statuses, dischargedAt: null);

	private async Task<(EmergencyCase Case, List<CaseTask> Tasks)> SaveCaseWithTasksAsync(
		CaseTaskStatus status,
		DateTimeOffset? dischargedAt = null) =>
		await SaveCaseWithTasksAsync(new[] { status }, dischargedAt);

	private async Task<(EmergencyCase Case, List<CaseTask> Tasks)> SaveCaseWithTasksAsync(
		CaseTaskStatus[] statuses,
		DateTimeOffset? dischargedAt)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		// Treatment, so a discharge move is allowed from it, as on the discharge tests.
		emergencyCase.Stage = CaseStage.Treatment;
		emergencyCase.DischargedAt = dischargedAt;
		var tasks = statuses.Select(status => TestData.Task(status: status)).ToList();
		foreach (var task in tasks)
		{
			emergencyCase.Tasks.Add(task);
		}
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return (emergencyCase, tasks);
	}

	private async Task<CaseTask> LoadTaskAsync(Guid taskId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.CaseTasks.SingleAsync(task => task.Id == taskId, _cancellationToken);
	}

	private async Task<List<CaseTask>> LoadCaseTasksAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.CaseTasks.Where(task => task.EmergencyCaseId == caseId).ToListAsync(_cancellationToken);
	}

	private async Task<List<string>> NextActionEntriesAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.CaseEvents
			.Where(caseEvent => caseEvent.EmergencyCaseId == caseId
				&& (caseEvent.Type == CaseEventType.NextActionDesignated || caseEvent.Type == CaseEventType.NextActionCleared))
			.OrderBy(caseEvent => caseEvent.CreatedAt)
			.Select(caseEvent => caseEvent.Description)
			.ToListAsync(_cancellationToken);
	}
}
