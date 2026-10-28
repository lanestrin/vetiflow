using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Owner records for hospital team members (build plan 4.6a). The tests share
// one database, so each one names its owners with its own unique text and
// searches for that.
public class OwnersEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task SearchOwners_MatchesFirstLastOrFullNameIgnoringCase()
	{
		var unique = Unique();
		var byFirst = OwnerNamed($"Ann{unique}", "Smith");
		var byLast = OwnerNamed("Bo", $"Lee{unique}");
		await SaveAsync(byFirst, byLast);
		using var client = await TeamClientAsync();

		var byFirstName = await SearchAsync(client, $"ann{unique}");
		var byFullName = await SearchAsync(client, $"BO LEE{unique}");
		var byShared = await SearchAsync(client, unique);

		Assert.Equal([byFirst.Id], byFirstName.Select(Id));
		Assert.Equal([byLast.Id], byFullName.Select(Id));
		Assert.Equal(2, byShared.Count);
	}

	[Fact]
	public async Task SearchOwners_OrdersByLastThenFirstName()
	{
		var unique = Unique();
		var zed = OwnerNamed("Amy", $"Zed{unique}");
		var adamsBeth = OwnerNamed("Beth", $"Adams{unique}");
		var adamsAl = OwnerNamed("Al", $"Adams{unique}");
		await SaveAsync(zed, adamsBeth, adamsAl);
		using var client = await TeamClientAsync();

		var owners = await SearchAsync(client, unique);

		Assert.Equal([adamsAl.Id, adamsBeth.Id, zed.Id], owners.Select(Id));
	}

	[Fact]
	public async Task SearchOwners_ReturnsAtMost25()
	{
		var unique = Unique();
		await SaveAsync(Enumerable.Range(0, 30).Select(index => OwnerNamed($"Many{index}", unique)).ToArray());
		using var client = await TeamClientAsync();

		var owners = await SearchAsync(client, unique);

		Assert.Equal(25, owners.Count);
	}

	[Theory]
	[InlineData("")]
	[InlineData("?search=")]
	[InlineData("?search=%20a%20")]
	public async Task SearchOwners_TooShortOrMissing_ReturnsValidationProblem(string query)
	{
		using var client = await TeamClientAsync();

		var response = await client.GetAsync($"/api/owners{query}", _cancellationToken);

		await AssertValidationProblemAsync(response, "search");
	}

	[Fact]
	public async Task SearchOwners_TooLong_ReturnsValidationProblem()
	{
		using var client = await TeamClientAsync();

		var response = await client.GetAsync($"/api/owners?search={new string('a', 101)}", _cancellationToken);

		await AssertValidationProblemAsync(response, "search");
	}

	[Fact]
	public async Task SearchOwners_WildcardCharacters_MatchLiterally()
	{
		var unique = Unique();
		var literal = OwnerNamed("Pat", $"{unique}%_\\x");
		var lookalike = OwnerNamed("Pat", $"{unique}abcx");
		await SaveAsync(literal, lookalike);
		using var client = await TeamClientAsync();

		var owners = await SearchAsync(client, $"{unique}%_\\");

		Assert.Equal([literal.Id], owners.Select(Id));
	}

	[Fact]
	public async Task GetOwner_ReturnsContactDetails()
	{
		var owner = TestData.Owner();
		await SaveAsync(owner);
		using var client = await TeamClientAsync();

		var found = await client.GetFromJsonAsync<JsonElement>($"/api/owners/{owner.Id}", _cancellationToken);

		Assert.Equal(owner.LastName, found.GetProperty("lastName").GetString());
		Assert.Equal(owner.Phone, found.GetProperty("phone").GetString());
		Assert.Equal(owner.Email, found.GetProperty("email").GetString());
	}

	[Fact]
	public async Task GetOwner_Unknown_ReturnsNotFound()
	{
		using var client = await TeamClientAsync();

		var response = await client.GetAsync($"/api/owners/{Guid.NewGuid()}", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task CreateOwner_ReturnsCreatedWithLocation()
	{
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/owners",
			new { firstName = "Riley", lastName = "Park", phone = "(312) 555-0144", email = "riley@example.com" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var created = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var id = created.GetProperty("id").GetGuid();
		Assert.EndsWith($"/api/owners/{id}", response.Headers.Location?.ToString(), StringComparison.OrdinalIgnoreCase);
		var saved = await FindAsync(id);
		Assert.Equal(("Riley", "Park", "(312) 555-0144", "riley@example.com"), (saved.FirstName, saved.LastName, saved.Phone, saved.Email));
	}

	[Fact]
	public async Task CreateOwner_TrimsAndStoresBlankOptionalFieldsAsNull()
	{
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/owners",
			new { firstName = "  Riley ", lastName = " Park", phone = "  ", email = "" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var created = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var saved = await FindAsync(created.GetProperty("id").GetGuid());
		Assert.Equal(("Riley", "Park"), (saved.FirstName, saved.LastName));
		Assert.Null(saved.Phone);
		Assert.Null(saved.Email);
	}

	[Theory]
	[InlineData("""{"lastName":"Park"}""", "firstName")]
	[InlineData("""{"firstName":"  ","lastName":"Park"}""", "firstName")]
	[InlineData("""{"firstName":"Riley","lastName":""}""", "lastName")]
	[InlineData("""{"firstName":"Riley","lastName":"Park","phone":"call me"}""", "phone")]
	[InlineData("""{"firstName":"Riley","lastName":"Park","phone":"---"}""", "phone")]
	[InlineData("""{"firstName":"Riley","lastName":"Park","email":"not-an-email"}""", "email")]
	public async Task CreateOwner_InvalidFields_ReturnsValidationProblem(string body, string field)
	{
		using var client = await TeamClientAsync();

		var response = await PostJsonAsync(client, "/api/owners", body);

		await AssertValidationProblemAsync(response, field);
	}

	[Fact]
	public async Task CreateOwner_NameTooLong_ReturnsValidationProblem()
	{
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/owners",
			new { firstName = new string('a', 101), lastName = "Park" },
			_cancellationToken);

		await AssertValidationProblemAsync(response, "firstName");
	}

	[Fact]
	public async Task CreateOwner_InvalidEmail_DoesNotEchoTheValue()
	{
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/owners",
			new { firstName = "Riley", lastName = "Park", email = "secret-value-123" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.DoesNotContain("secret-value-123", await response.Content.ReadAsStringAsync(_cancellationToken));
	}

	[Fact]
	public async Task UpdateOwner_ReplacesFields()
	{
		var owner = TestData.Owner();
		await SaveAsync(owner);
		using var client = await TeamClientAsync();

		var response = await client.PutAsJsonAsync(
			$"/api/owners/{owner.Id}",
			new { firstName = "Sam", lastName = "Ortiz", phone = "312-555-0177" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var saved = await FindAsync(owner.Id);
		Assert.Equal(("Sam", "Ortiz", "312-555-0177"), (saved.FirstName, saved.LastName, saved.Phone));
		Assert.Null(saved.Email);
	}

	[Fact]
	public async Task UpdateOwner_Unknown_ReturnsNotFound()
	{
		using var client = await TeamClientAsync();

		var response = await client.PutAsJsonAsync(
			$"/api/owners/{Guid.NewGuid()}",
			new { firstName = "Sam", lastName = "Ortiz" },
			_cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Theory]
	[MemberData(nameof(Routes))]
	public async Task OwnerEndpoints_SignedOut_Return401(string method, string path)
	{
		using var client = factory.CreateClient();

		var response = await SendAsync(client, method, path);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Theory]
	[MemberData(nameof(Routes))]
	public async Task OwnerEndpoints_PetParent_Return403(string method, string path)
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await SendAsync(client, method, path);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
	}

	public static TheoryData<string, string> Routes => new()
	{
		{ "GET", "/api/owners?search=Hale" },
		{ "GET", $"/api/owners/{Guid.NewGuid()}" },
		{ "POST", "/api/owners" },
		{ "PUT", $"/api/owners/{Guid.NewGuid()}" }
	};

	private Task<HttpResponseMessage> SendAsync(HttpClient client, string method, string path)
	{
		var request = new HttpRequestMessage(new HttpMethod(method), path);
		if (method is "POST" or "PUT")
		{
			request.Content = JsonContent.Create(new { firstName = "Riley", lastName = "Park" });
		}

		return client.SendAsync(request, _cancellationToken);
	}

	private Task<HttpClient> TeamClientAsync() => factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

	private async Task<List<JsonElement>> SearchAsync(HttpClient client, string text) =>
		(await client.GetFromJsonAsync<List<JsonElement>>(
			$"/api/owners?search={Uri.EscapeDataString(text)}",
			_cancellationToken))!;

	private Task<HttpResponseMessage> PostJsonAsync(HttpClient client, string path, string body) =>
		client.PostAsync(path, new StringContent(body, System.Text.Encoding.UTF8, "application/json"), _cancellationToken);

	private async Task AssertValidationProblemAsync(HttpResponseMessage response, string field)
	{
		AssertProblemStatus(response, HttpStatusCode.BadRequest);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var fields = problem.GetProperty("errors").EnumerateObject().Select(error => error.Name);
		Assert.Contains(fields, name => name.Equals(field, StringComparison.OrdinalIgnoreCase));
	}

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	private static Guid Id(JsonElement owner) => owner.GetProperty("id").GetGuid();

	private static Owner OwnerNamed(string firstName, string lastName) => new()
	{
		FirstName = firstName,
		LastName = lastName
	};

	private static string Unique() => Guid.NewGuid().ToString("N")[..8];

	private async Task<Owner> FindAsync(Guid id)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.Owners.SingleAsync(owner => owner.Id == id, _cancellationToken);
	}

	private async Task SaveAsync(params Owner[] owners)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.Owners.AddRange(owners);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}
}
