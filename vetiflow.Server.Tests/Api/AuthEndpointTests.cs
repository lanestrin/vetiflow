using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using vetiflow.Server.Data;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Demo sign-in by email (build plan S.17). VetiFlowApiFactory seeds the two
// demo accounts, so these tests sign in with them as the login page will.
public class AuthEndpointTests(VetiFlowApiFactory factory)
{
	private const string TeamEmail = "team@vetiflow.demo";
	private const string ParentEmail = "parent@vetiflow.demo";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task SignInByEmail_TeamDemoAccount_ReturnsBearerToken()
	{
		using var client = factory.CreateClient();

		var response = await SignInAsync(client, TeamEmail, DbSeeder.DemoPassword);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var token = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal("Bearer", token.GetProperty("tokenType").GetString());
		Assert.False(string.IsNullOrWhiteSpace(token.GetProperty("accessToken").GetString()));
		Assert.True(token.GetProperty("expiresIn").GetInt64() > 0);
	}

	[Fact]
	public async Task SignInByEmail_PetParentDemoAccount_ReturnsBearerToken()
	{
		using var client = factory.CreateClient();

		var response = await SignInAsync(client, ParentEmail, DbSeeder.DemoPassword);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
	}

	[Fact]
	public async Task SignInByEmail_TrimsAndIgnoresCase()
	{
		using var client = factory.CreateClient();

		var response = await SignInAsync(client, "  Team@VetiFlow.demo ", DbSeeder.DemoPassword);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
	}

	[Fact]
	public async Task SignInByEmail_UnknownEmail_ReturnsUnknownAccount()
	{
		using var client = factory.CreateClient();

		var response = await SignInAsync(client, "nobody@vetiflow.demo", DbSeeder.DemoPassword);

		await AssertSignInFailedAsync(response, "unknownAccount");
	}

	[Fact]
	public async Task SignInByEmail_WrongPassword_ReturnsWrongPassword()
	{
		using var client = factory.CreateClient();

		var response = await SignInAsync(client, TeamEmail, "not-the-password");

		await AssertSignInFailedAsync(response, "wrongPassword");
	}

	[Fact]
	public async Task SignInByEmail_InactiveAccount_ReturnsInactiveAccount()
	{
		var account = TestData.PetParentAccount(TestData.Owner());
		account.PasswordHash = new PasswordHasher<Account>().HashPassword(account, DbSeeder.DemoPassword);
		account.IsActive = false;
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.Accounts.Add(account);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = factory.CreateClient();

		var response = await SignInAsync(client, account.Email!, DbSeeder.DemoPassword);

		await AssertSignInFailedAsync(response, "inactiveAccount");
	}

	[Theory]
	[InlineData("""{"password":"welcome1"}""")]
	[InlineData("""{"email":"not-an-email","password":"welcome1"}""")]
	[InlineData("""{"email":"team@vetiflow.demo"}""")]
	[InlineData("""{"email":"team@vetiflow.demo","password":""}""")]
	public async Task SignInByEmail_InvalidRequest_ReturnsValidationProblem(string body)
	{
		using var client = factory.CreateClient();

		var response = await client.PostAsync(
			"/api/auth/email",
			new StringContent(body, Encoding.UTF8, "application/json"),
			_cancellationToken);

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	[Fact]
	public async Task SignInByEmail_TooLongPassword_ReturnsValidationProblem()
	{
		using var client = factory.CreateClient();

		var response = await SignInAsync(client, TeamEmail, new string('x', 129));

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
	}

	[Fact]
	public async Task SignInByEmail_ResponseNeverContainsPasswordHash()
	{
		string hash;
		await using (var dbContext = factory.CreateDbContext())
		{
			hash = dbContext.Accounts.Single(account => account.Email == TeamEmail).PasswordHash!;
		}
		using var client = factory.CreateClient();

		var success = await SignInAsync(client, TeamEmail, DbSeeder.DemoPassword);
		var failure = await SignInAsync(client, TeamEmail, "not-the-password");

		Assert.DoesNotContain(hash, await success.Content.ReadAsStringAsync(_cancellationToken));
		Assert.DoesNotContain(hash, await failure.Content.ReadAsStringAsync(_cancellationToken));
	}

	[Fact]
	public async Task Me_WithTeamToken_ReturnsTeamMemberExperience()
	{
		using var client = await SignedInClientAsync(TeamEmail);

		var me = await client.GetFromJsonAsync<JsonElement>("/api/auth/me", _cancellationToken);

		Assert.Equal("Jordan Lee", me.GetProperty("name").GetString());
		Assert.Equal("teamMember", me.GetProperty("experience").GetString());
		Assert.Equal("Dr. Jordan Lee", me.GetProperty("displayName").GetString());
		Assert.Equal("JL", me.GetProperty("initials").GetString());
		Assert.Equal("veterinarian", me.GetProperty("role").GetString());
	}

	[Fact]
	public async Task Me_WithPetParentToken_ReturnsPetParentExperience()
	{
		using var client = await SignedInClientAsync(ParentEmail);

		var me = await client.GetFromJsonAsync<JsonElement>("/api/auth/me", _cancellationToken);

		Assert.Equal("Morgan Hale", me.GetProperty("name").GetString());
		Assert.Equal("petParent", me.GetProperty("experience").GetString());
		Assert.Equal("Morgan Hale", me.GetProperty("displayName").GetString());
		Assert.Equal("MH", me.GetProperty("initials").GetString());
		Assert.Equal(JsonValueKind.Null, me.GetProperty("role").ValueKind);
	}

	// Only veterinarians get the "Dr." title (build plan 2.10a).
	[Fact]
	public async Task Me_Technician_HasNoTitle()
	{
		var staffMember = TestData.StaffMember(StaffRole.Technician);
		staffMember.FirstName = "sam";
		var account = await AddAccountAsync(TestData.TeamMemberAccount(staffMember));
		using var client = await SignedInClientAsync(account.Email!);

		var me = await client.GetFromJsonAsync<JsonElement>("/api/auth/me", _cancellationToken);

		Assert.Equal($"sam {staffMember.LastName}", me.GetProperty("displayName").GetString());
		Assert.Equal($"S{char.ToUpperInvariant(staffMember.LastName[0])}", me.GetProperty("initials").GetString());
		Assert.Equal("technician", me.GetProperty("role").GetString());
	}

	// The token outlives the account: the profile can't be built, so 401.
	[Fact]
	public async Task Me_AccountNoLongerExists_Returns401Problem()
	{
		var account = await AddAccountAsync(TestData.PetParentAccount(TestData.Owner()));
		using var client = await SignedInClientAsync(account.Email!);
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.Accounts.Remove(await dbContext.Accounts.FindAsync([account.Id], _cancellationToken) ?? throw new InvalidOperationException());
			await dbContext.SaveChangesAsync(_cancellationToken);
		}

		var response = await client.GetAsync("/api/auth/me", _cancellationToken);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	[Fact]
	public async Task Me_WithoutToken_Returns401Problem()
	{
		using var client = factory.CreateClient();

		var response = await client.GetAsync("/api/auth/me", _cancellationToken);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	[Fact]
	public async Task Me_WithMadeUpToken_Returns401Problem()
	{
		using var client = factory.CreateClient();
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "made-up-token");

		var response = await client.GetAsync("/api/auth/me", _cancellationToken);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	// Phone sign-in (S.19): sending the code is simulated in the browser, so
	// verify is the only phone endpoint. The demo numbers, every usual way of
	// writing them.
	[Theory]
	[InlineData("312-555-0101")]
	[InlineData("(312) 555-0101")]
	[InlineData("3125550101")]
	[InlineData("+1 312 555 0101")]
	public async Task VerifyPhone_DemoNumberAnyFormat_ReturnsBearerToken(string phoneNumber)
	{
		using var client = factory.CreateClient();

		var response = await VerifyPhoneAsync(client, phoneNumber, "123456");

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
	}

	[Fact]
	public async Task VerifyPhone_UnknownNumber_ReturnsUnknownPhone()
	{
		using var client = factory.CreateClient();

		var response = await VerifyPhoneAsync(client, "312-555-0199", "123456");

		await AssertSignInFailedAsync(response, "unknownPhone");
	}

	[Theory]
	[InlineData("555-0101")]
	[InlineData("+44 20 7946 0958")]
	[InlineData("call 3125550101")]
	public async Task VerifyPhone_InvalidNumber_ReturnsValidationProblem(string phoneNumber)
	{
		using var client = factory.CreateClient();

		var response = await VerifyPhoneAsync(client, phoneNumber, "123456");

		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	// The step-one endpoint is gone; nothing answers there.
	[Fact]
	public async Task StartPhone_IsGone()
	{
		using var client = factory.CreateClient();

		var response = await client.PostAsJsonAsync("/api/auth/phone/start", new { phoneNumber = "312-555-0101" }, _cancellationToken);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	[Fact]
	public async Task VerifyPhone_TeamNumberAndDemoCode_ReturnsBearerToken()
	{
		using var client = factory.CreateClient();

		var response = await VerifyPhoneAsync(client, "312-555-0101", "123456");

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var me = await MeWithTokenAsync(client, response);
		Assert.Equal("Jordan Lee", me.GetProperty("name").GetString());
		Assert.Equal("teamMember", me.GetProperty("experience").GetString());
		Assert.Equal("Dr. Jordan Lee", me.GetProperty("displayName").GetString());
		Assert.Equal("JL", me.GetProperty("initials").GetString());
		Assert.Equal("veterinarian", me.GetProperty("role").GetString());
	}

	[Fact]
	public async Task VerifyPhone_PetParentNumberAndDemoCode_ReturnsBearerToken()
	{
		using var client = factory.CreateClient();

		var response = await VerifyPhoneAsync(client, "(312) 555-0102", "123456");

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var me = await MeWithTokenAsync(client, response);
		Assert.Equal("petParent", me.GetProperty("experience").GetString());
	}

	[Fact]
	public async Task VerifyPhone_WrongCode_ReturnsWrongCode()
	{
		using var client = factory.CreateClient();

		var response = await VerifyPhoneAsync(client, "312-555-0101", "654321");

		await AssertSignInFailedAsync(response, "wrongCode");
	}

	[Fact]
	public async Task VerifyPhone_InactiveAccount_ReturnsInactiveAccount()
	{
		var account = TestData.PetParentAccount(TestData.Owner());
		account.IsActive = false;
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.Accounts.Add(account);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = factory.CreateClient();

		var response = await VerifyPhoneAsync(client, account.PhoneNumber!, "123456");

		await AssertSignInFailedAsync(response, "inactiveAccount");
	}

	// Where the setting is off (production with real data), the published code
	// must not work at all.
	[Fact]
	public async Task PhoneSignIn_WhenDemoSignInIsOff_ReturnsPhoneSignInOff()
	{
		using var host = factory.WithWebHostBuilder(builder => builder.UseSetting("DemoSignIn:Enabled", "false"));
		using var client = host.CreateClient();

		var response = await VerifyPhoneAsync(client, "312-555-0101", "123456");

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal("phoneSignInOff", problem.GetProperty("code").GetString());
	}

	private Task<HttpResponseMessage> VerifyPhoneAsync(HttpClient client, string phoneNumber, string code) =>
		client.PostAsJsonAsync("/api/auth/phone/verify", new { phoneNumber, code }, _cancellationToken);

	private async Task<JsonElement> MeWithTokenAsync(HttpClient client, HttpResponseMessage tokenResponse)
	{
		var token = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		client.DefaultRequestHeaders.Authorization =
			new AuthenticationHeaderValue("Bearer", token.GetProperty("accessToken").GetString());
		return await client.GetFromJsonAsync<JsonElement>("/api/auth/me", _cancellationToken);
	}

	// Saves an account that signs in with the demo password.
	private async Task<Account> AddAccountAsync(Account account)
	{
		account.PasswordHash = new PasswordHasher<Account>().HashPassword(account, DbSeeder.DemoPassword);
		await using var dbContext = factory.CreateDbContext();
		dbContext.Accounts.Add(account);
		await dbContext.SaveChangesAsync(_cancellationToken);
		return account;
	}

	private Task<HttpResponseMessage> SignInAsync(HttpClient client, string email, string password) =>
		client.PostAsJsonAsync("/api/auth/email", new { email, password }, _cancellationToken);

	private async Task<HttpClient> SignedInClientAsync(string email)
	{
		var client = factory.CreateClient();
		var response = await SignInAsync(client, email, DbSeeder.DemoPassword);
		var token = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		client.DefaultRequestHeaders.Authorization =
			new AuthenticationHeaderValue("Bearer", token.GetProperty("accessToken").GetString());
		return client;
	}

	private async Task AssertSignInFailedAsync(HttpResponseMessage response, string code)
	{
		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal(code, problem.GetProperty("code").GetString());
	}
}
