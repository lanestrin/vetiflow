using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Case tags (build plan 3.5a): the limits, the refusals, and the timeline entry
// for each change.
public class CaseTagsEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task AddTag_ValidTag_Returns201WithTextToneAndCreator()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = "  O2 support  ", tone = "caution" });

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var created = await response.Content.ReadFromJsonAsync<CreatedTag>(_cancellationToken);
		Assert.Equal("O2 support", created!.Text);
		Assert.Equal("caution", created.Tone);
		Assert.Equal("Jordan", created.CreatedBy?.Name.Split(' ')[0]);
	}

	[Fact]
	public async Task AddTag_RecordsTagAddedOnTheTimelineWithTheActor()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		await PostTagAsync(client, emergencyCase.Id, new { text = "O2 support", tone = "caution" });

		var saved = await LoadWithEventsAsync(emergencyCase.Id);
		var added = Assert.Single(saved.Events);
		Assert.Equal(CaseEventType.TagAdded, added.Type);
		Assert.Equal("Tag added: O2 support", added.Description);
		Assert.Equal("Jordan", added.CreatedByStaff?.FirstName);
	}

	[Theory]
	[InlineData("   ")]
	[InlineData("")]
	public async Task AddTag_BlankText_Returns400NamingTheField(string text)
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text, tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.BadRequest);
		Assert.Contains("Text", await response.Content.ReadAsStringAsync(_cancellationToken));
		Assert.Empty(await LoadTagsAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task AddTag_TextAtTheLimit_IsAccepted()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = new string('a', CaseTagRules.MaxTextLength), tone = "info" });

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
	}

	[Fact]
	public async Task AddTag_TextOverTheLimit_Returns400WithoutEchoingTheText()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var tooLong = new string('z', CaseTagRules.MaxTextLength + 1);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = tooLong, tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.BadRequest);
		var problem = await response.Content.ReadAsStringAsync(_cancellationToken);
		Assert.Contains("Text", problem);
		Assert.DoesNotContain(tooLong, problem);
		Assert.Empty(await LoadTagsAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task AddTag_UnknownTone_Returns400NamingTheField()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = "O2 support", tone = "urgent" });

		AssertProblemStatus(response, HttpStatusCode.BadRequest);
		Assert.Contains("tone", await response.Content.ReadAsStringAsync(_cancellationToken), StringComparison.OrdinalIgnoreCase);
		Assert.Empty(await LoadTagsAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task AddTag_SixthTag_Returns409AndSavesNothing()
	{
		var emergencyCase = await SaveCaseAsync(tagCount: CaseTagRules.MaxTagsPerCase);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = "Sixth", tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Equal(CaseTagRules.MaxTagsPerCase, (await LoadTagsAsync(emergencyCase.Id)).Count);
	}

	[Fact]
	public async Task AddTag_TextTheCaseAlreadyHas_Returns409IgnoringCase()
	{
		var emergencyCase = await SaveCaseAsync(tagCount: 1, tagText: "O2 support");
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = "o2 SUPPORT", tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Single(await LoadTagsAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task AddTag_TwoConcurrentAddsAtFourTags_LeaveFiveNotSix()
	{
		var emergencyCase = await SaveCaseAsync(tagCount: CaseTagRules.MaxTagsPerCase - 1);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var responses = await Task.WhenAll(
			PostTagAsync(client, emergencyCase.Id, new { text = "First new", tone = "info" }),
			PostTagAsync(client, emergencyCase.Id, new { text = "Second new", tone = "info" }));

		Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
		Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
		Assert.Equal(CaseTagRules.MaxTagsPerCase, (await LoadTagsAsync(emergencyCase.Id)).Count);
	}

	[Fact]
	public async Task AddTag_UnknownCase_Returns404()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, Guid.NewGuid(), new { text = "O2 support", tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task AddTag_DischargedCase_Returns409()
	{
		var emergencyCase = await SaveCaseAsync(dischargedAt: DateTimeOffset.UtcNow);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = "O2 support", tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Empty(await LoadTagsAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task AddTag_SignedOut_Returns401()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = factory.CreateClient();

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = "O2 support", tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task AddTag_PetParent_Returns403AndSavesNothing()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await PostTagAsync(client, emergencyCase.Id, new { text = "O2 support", tone = "info" });

		AssertProblemStatus(response, HttpStatusCode.Forbidden);
		Assert.Empty(await LoadTagsAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task AddTag_NotifiesConnectedBoards()
	{
		var emergencyCase = await SaveCaseAsync();
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

		await PostTagAsync(client, emergencyCase.Id, new { text = "O2 support", tone = "info" });

		await notified.Task.WaitAsync(TimeSpan.FromSeconds(10), _cancellationToken);
	}

	[Fact]
	public async Task RemoveTag_DeletesItAndRecordsTheRemovedTextOnTheTimeline()
	{
		var emergencyCase = await SaveCaseAsync(tagCount: 2);
		var tags = await LoadTagsAsync(emergencyCase.Id);
		var removed = tags.Single(tag => tag.Text == "Existing 0");
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.DeleteAsync($"/api/cases/{emergencyCase.Id}/tags/{removed.Id}", _cancellationToken);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		var remaining = await LoadTagsAsync(emergencyCase.Id);
		Assert.Equal(["Existing 1"], remaining.Select(tag => tag.Text));
		var saved = await LoadWithEventsAsync(emergencyCase.Id);
		var removedEvent = Assert.Single(saved.Events);
		Assert.Equal(CaseEventType.TagRemoved, removedEvent.Type);
		Assert.Equal("Tag removed: Existing 0", removedEvent.Description);
		Assert.Equal("Jordan", removedEvent.CreatedByStaff?.FirstName);
	}

	[Fact]
	public async Task RemoveTag_TagOfAnotherCase_Returns404AndLeavesItAlone()
	{
		var owner = await SaveCaseAsync(tagCount: 1);
		var other = await SaveCaseAsync();
		var tag = (await LoadTagsAsync(owner.Id)).Single();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.DeleteAsync($"/api/cases/{other.Id}/tags/{tag.Id}", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.NotFound);
		Assert.Single(await LoadTagsAsync(owner.Id));
	}

	[Fact]
	public async Task RemoveTag_DischargedCase_Returns409AndLeavesTheTagAlone()
	{
		var emergencyCase = await SaveCaseAsync(tagCount: 1, dischargedAt: DateTimeOffset.UtcNow);
		var tag = (await LoadTagsAsync(emergencyCase.Id)).Single();
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.DeleteAsync($"/api/cases/{emergencyCase.Id}/tags/{tag.Id}", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.Conflict);
		Assert.Single(await LoadTagsAsync(emergencyCase.Id));
	}

	[Fact]
	public async Task CaseDetail_ListsTagsOldestFirstWithTheirCreator()
	{
		var emergencyCase = await SaveCaseAsync(tagCount: 3);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.GetAsync($"/api/cases/{emergencyCase.Id}", _cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var detail = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var texts = detail.GetProperty("tags").EnumerateArray().Select(tag => tag.GetProperty("text").GetString());
		Assert.Equal(["Existing 0", "Existing 1", "Existing 2"], texts);
	}

	private Task<HttpResponseMessage> PostTagAsync(HttpClient client, Guid caseId, object body) =>
		client.PostAsJsonAsync($"/api/cases/{caseId}/tags", body, _cancellationToken);

	// A case with the given number of tags, the first of them tagText, when given.
	private async Task<EmergencyCase> SaveCaseAsync(
		int tagCount = 0,
		string? tagText = null,
		DateTimeOffset? dischargedAt = null)
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		emergencyCase.DischargedAt = dischargedAt;
		for (var index = 0; index < tagCount; index++)
		{
			emergencyCase.Tags.Add(new CaseTag
			{
				Text = index == 0 && tagText is not null ? tagText : $"Existing {index}",
				Tone = CaseTagTone.Neutral,
				// Whole seconds, so the value survives Postgres's microsecond precision.
				CreatedAt = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.AddMinutes(index - tagCount).ToUnixTimeSeconds())
			});
		}

		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}

	private async Task<List<CaseTag>> LoadTagsAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.CaseTags
			.Where(tag => tag.EmergencyCaseId == caseId)
			.ToListAsync(_cancellationToken);
	}

	private async Task<EmergencyCase> LoadWithEventsAsync(Guid caseId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.EmergencyCases
			.Include(c => c.Events).ThenInclude(e => e.CreatedByStaff)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
	}

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	private sealed record CreatedTag(Guid Id, string Text, string Tone, CreatedByReference? CreatedBy);

	private sealed record CreatedByReference(Guid Id, string Name);
}
