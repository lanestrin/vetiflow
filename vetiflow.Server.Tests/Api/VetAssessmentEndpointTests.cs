using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// The initial veterinarian assessment (build plan 2.16a): when it happened, who
// recorded it and when, once per case. It is never inferred.
public class VetAssessmentEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Record_Now_StoresTheTimesAndAssessorAndWritesOneEntry()
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await PostAsync(client, emergencyCase.Id, null);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.InRange(saved.VetAssessedAt!.Value, before, DateTimeOffset.UtcNow);
		Assert.Equal(saved.VetAssessedAt, saved.VetAssessmentRecordedAt);
		Assert.NotNull(saved.VetAssessedByStaffId);
		Assert.Equal(["Seen by veterinarian"], await AssessmentEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Record_AnEarlierTime_KeepsItApartFromTheEntryTime()
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var occurredAt = DateTimeOffset.UtcNow.AddMinutes(-10);

		var response = await PostAsync(client, emergencyCase.Id, occurredAt.ToString("o", CultureInfo.InvariantCulture));

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var saved = await LoadCaseAsync(emergencyCase.Id);
		Assert.Equal(occurredAt.ToUnixTimeMilliseconds(), saved.VetAssessedAt!.Value.ToUnixTimeMilliseconds());
		Assert.True(saved.VetAssessmentRecordedAt > saved.VetAssessedAt);
	}

	[Theory]
	[InlineData(5)] // in the future
	[InlineData(-60)] // before the patient arrived
	public async Task Record_AnInvalidTime_Returns400AndChangesNothing(int minutesFromNow)
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var occurredAt = DateTimeOffset.UtcNow.AddMinutes(minutesFromNow).ToString("o", CultureInfo.InvariantCulture);

		var response = await PostAsync(client, emergencyCase.Id, occurredAt);

		await AssertRejectsOccurredAtAsync(response);
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).VetAssessedAt);
	}

	[Fact]
	public async Task Record_ATimeWithoutAnOffset_Returns400()
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostAsync(client, emergencyCase.Id, "2026-11-03T10:00:00");

		await AssertRejectsOccurredAtAsync(response);
	}

	[Fact]
	public async Task Record_UnknownCase_Returns404()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostAsync(client, Guid.NewGuid(), null);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	[Fact]
	public async Task Record_DischargedCase_Returns409()
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30, dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostAsync(client, emergencyCase.Id, null);

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).VetAssessedAt);
	}

	[Fact]
	public async Task Record_ASecondTime_Returns409AndKeepsTheFirst()
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		await PostAsync(client, emergencyCase.Id, null);
		var first = (await LoadCaseAsync(emergencyCase.Id)).VetAssessedAt;

		var again = await PostAsync(client, emergencyCase.Id, null);

		Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
		Assert.Equal(first, (await LoadCaseAsync(emergencyCase.Id)).VetAssessedAt);
		Assert.Single(await AssessmentEntriesAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task Record_SignedOut_Returns401()
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30);
		using var client = factory.CreateClient();

		var response = await PostAsync(client, emergencyCase.Id, null);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Fact]
	public async Task Record_AsPetParent_Returns403()
	{
		var emergencyCase = await SaveCaseAsync(arrivedMinutesAgo: 30);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PostAsync(client, emergencyCase.Id, null);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
		Assert.Null((await LoadCaseAsync(emergencyCase.Id)).VetAssessedAt);
	}

	private static async Task AssertRejectsOccurredAtAsync(HttpResponseMessage response)
	{
		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		var body = await response.Content.ReadAsStringAsync();
		Assert.Contains("OccurredAt", body, StringComparison.Ordinal);
	}

	private Task<HttpResponseMessage> PostAsync(HttpClient client, Guid caseId, string? occurredAt) =>
		client.PostAsJsonAsync($"/api/cases/{caseId}/vet-assessment", new { occurredAt }, _cancellationToken);

	private async Task<EmergencyCase> SaveCaseAsync(int arrivedMinutesAgo, DateTimeOffset? dischargedAt = null)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.ArrivalTime = DateTimeOffset.UtcNow.AddMinutes(-arrivedMinutesAgo);
		emergencyCase.DischargedAt = dischargedAt;
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	private async Task<EmergencyCase> LoadCaseAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases.AsNoTracking().SingleAsync(c => c.Id == caseId, _cancellationToken);
	}

	private async Task<List<string>> AssessmentEntriesAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.CaseEvents
			.Where(caseEvent => caseEvent.EmergencyCaseId == caseId && caseEvent.Type == CaseEventType.VetAssessed)
			.Select(caseEvent => caseEvent.Description)
			.ToListAsync(_cancellationToken);
	}
}
