using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using vetiflow.Server.Hosting;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

public class CorsTests(VetiFlowApiFactory factory)
{
	private const string ProductionOrigin = "https://vetiflow.vercel.app";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Preflight_FromConfiguredOrigin_IsAllowed()
	{
		using var client = factory.CreateClient();

		var allowedOrigin = await PreflightAsync(client, ProductionOrigin);

		Assert.Equal(ProductionOrigin, allowedOrigin);
	}

	[Fact]
	public async Task Preflight_FromOtherOrigin_IsNotAllowed()
	{
		using var client = factory.CreateClient();

		var allowedOrigin = await PreflightAsync(client, "https://attacker.example");

		Assert.Null(allowedOrigin);
	}

	[Fact]
	public async Task Preflight_WithOverriddenOrigins_AllowsOnlyThose()
	{
		// As Render would set Cors__AllowedOrigins__0.
		using var host = factory.WithWebHostBuilder(builder =>
			builder.UseSetting("Cors:AllowedOrigins:0", "https://other.example"));
		using var client = host.CreateClient();

		Assert.Equal("https://other.example", await PreflightAsync(client, "https://other.example"));
		Assert.Null(await PreflightAsync(client, ProductionOrigin));
	}

	[Theory]
	[InlineData("*")]
	[InlineData("http://client.example")]
	[InlineData("https://client.example/")]
	[InlineData("https://client.example/board")]
	[InlineData("https://user@client.example")]
	[InlineData("client.example")]
	[InlineData("")]
	public void Read_WithInvalidOrigin_FailsNamingTheSetting(string origin)
	{
		var configuration = Configuration(new() { ["Cors:AllowedOrigins:0"] = origin });

		var exception = Assert.Throws<InvalidOperationException>(() => CorsOrigins.Read(configuration));

		Assert.Contains(CorsOrigins.SettingName, exception.Message);
		if (origin.Length > 1)
		{
			Assert.DoesNotContain(origin, exception.Message);
		}
	}

	[Fact]
	public void Read_WithNoOrigins_FailsNamingTheSetting()
	{
		var exception = Assert.Throws<InvalidOperationException>(() => CorsOrigins.Read(Configuration(new())));

		Assert.Contains(CorsOrigins.SettingName, exception.Message);
	}

	[Fact]
	public void Read_WithValidOrigins_ReturnsThem()
	{
		var configuration = Configuration(new()
		{
			["Cors:AllowedOrigins:0"] = ProductionOrigin,
			["Cors:AllowedOrigins:1"] = "https://localhost:52540"
		});

		Assert.Equal([ProductionOrigin, "https://localhost:52540"], CorsOrigins.Read(configuration));
	}

	[Fact]
	public void Startup_WithInvalidOrigins_FailsNamingTheSetting()
	{
		using var host = factory.WithWebHostBuilder(builder =>
			builder.UseSetting("Cors:AllowedOrigins:0", "*"));

		var exception = Record.Exception(() => host.Server);

		Assert.NotNull(exception);
		Assert.Contains(CorsOrigins.SettingName, exception.ToString());
	}

	// Returns the Access-Control-Allow-Origin the API answers with, or null.
	private async Task<string?> PreflightAsync(HttpClient client, string origin)
	{
		using var request = new HttpRequestMessage(HttpMethod.Options, "/api/cases");
		request.Headers.Add("Origin", origin);
		request.Headers.Add("Access-Control-Request-Method", "GET");

		using var response = await client.SendAsync(request, _cancellationToken);

		return response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values)
			? values.Single()
			: null;
	}

	private static IConfiguration Configuration(Dictionary<string, string?> values) =>
		new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
