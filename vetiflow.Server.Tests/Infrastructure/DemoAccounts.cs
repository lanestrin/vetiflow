using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using vetiflow.Server.Data;

namespace vetiflow.Server.Tests.Infrastructure;

// The seeded demo accounts (DbSeeder), for tests that call endpoints behind
// sign-in. Signing in goes through the real endpoint, as the client does.
public static class DemoAccounts
{
	public const string TeamEmail = "team@vetiflow.demo";
	public const string ParentEmail = "parent@vetiflow.demo";

	public static async Task<HttpClient> SignInAsync(this HttpClient client, string email)
	{
		var response = await client.PostAsJsonAsync(
			"/api/auth/email",
			new { email, password = DbSeeder.DemoPassword });
		response.EnsureSuccessStatusCode();

		var token = await response.Content.ReadFromJsonAsync<JsonElement>();
		client.DefaultRequestHeaders.Authorization =
			new AuthenticationHeaderValue("Bearer", token.GetProperty("accessToken").GetString());
		return client;
	}
}
