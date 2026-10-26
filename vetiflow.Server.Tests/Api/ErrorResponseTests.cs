using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Every error is ProblemDetails, so the client and later forms can rely on one
// shape, and none of them shows how the server works inside.
public class ErrorResponseTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task UnknownRoute_ReturnsNotFoundProblem()
	{
		using var client = factory.CreateClient();

		var response = await client.GetAsync("/api/no-such-route", _cancellationToken);

		await AssertProblemAsync(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task UpdateStage_UnknownCase_ReturnsNotFoundProblem()
	{
		using var client = factory.CreateClient();

		var response = await client.PatchAsJsonAsync(
			$"/api/cases/{Guid.NewGuid()}/stage",
			new { stage = "treatment" },
			_cancellationToken);

		await AssertProblemAsync(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task UpdateStage_NonGuidId_ReturnsNotFoundProblem()
	{
		using var client = factory.CreateClient();

		var response = await client.PatchAsJsonAsync(
			"/api/cases/not-a-guid/stage",
			new { stage = "treatment" },
			_cancellationToken);

		await AssertProblemAsync(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task UpdateStage_MalformedJson_ReturnsValidationProblem()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = factory.CreateClient();

		var response = await client.PatchAsync(
			$"/api/cases/{emergencyCase.Id}/stage",
			new StringContent("""{"stage":""", Encoding.UTF8, "application/json"),
			_cancellationToken);

		var problem = await AssertProblemAsync(response, HttpStatusCode.BadRequest);
		Assert.True(problem.TryGetProperty("errors", out _), "A validation problem lists its errors by field.");
	}

	[Fact]
	public async Task UpdateStage_WrongContentType_ReturnsUnsupportedMediaTypeProblem()
	{
		var emergencyCase = await SaveCaseAsync();
		using var client = factory.CreateClient();

		var response = await client.PatchAsync(
			$"/api/cases/{emergencyCase.Id}/stage",
			new StringContent("stage=treatment", Encoding.UTF8, "text/plain"),
			_cancellationToken);

		await AssertProblemAsync(response, HttpStatusCode.UnsupportedMediaType);
	}

	// A real failure in Production: the database is down, so the query throws.
	[Fact]
	public async Task GetCases_DatabaseUnreachable_ReturnsProblemWithoutInternals()
	{
		using var host = TestHosts.Create(TestHosts.UnreachableDatabase, environment: "Production");
		using var client = host.CreateClient();

		var response = await client.GetAsync("/api/cases", _cancellationToken);

		var problem = await AssertProblemAsync(response, HttpStatusCode.InternalServerError);
		var json = problem.GetRawText();
		Assert.False(problem.TryGetProperty("detail", out _), "A server error must not describe the exception.");
		Assert.DoesNotContain("Exception", json);
		Assert.DoesNotContain("Npgsql", json);
		Assert.DoesNotContain("127.0.0.1", json);
		Assert.DoesNotContain("   at ", json);
	}

	private async Task<JsonElement> AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
		Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("title").GetString()));
		return problem;
	}

	private async Task<EmergencyCase> SaveCaseAsync()
	{
		var emergencyCase = TestData.Case(TestData.Patient());
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.Add(emergencyCase);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return emergencyCase;
	}
}
