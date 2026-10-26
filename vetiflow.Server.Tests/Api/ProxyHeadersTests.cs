using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Requests as they arrive through Render's proxy. The Host is not localhost,
// because HSTS never applies to localhost.
public class ProxyHeadersTests(VetiFlowApiFactory factory)
{
	private const string PublicHost = "api.vetiflow.test";
	private const string RemoteAddressPath = "/test/remote-address";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Request_ForwardedAsHttps_GetsHsts()
	{
		using var client = factory.CreateClient();

		using var response = await SendAsync(client, "/api/health", forwardedProto: "https");

		Assert.True(response.Headers.Contains("Strict-Transport-Security"));
	}

	[Fact]
	public async Task Request_NotForwarded_GetsNoHsts()
	{
		using var client = factory.CreateClient();

		using var response = await SendAsync(client, "/api/health");

		Assert.False(response.Headers.Contains("Strict-Transport-Security"));
	}

	[Fact]
	public async Task Request_WithForwardedFor_SeesNearestProxyAddressOnly()
	{
		using var host = factory.WithWebHostBuilder(builder =>
			builder.ConfigureServices(services =>
				services.AddSingleton<IStartupFilter, RemoteAddressEndpoint>()));
		using var client = host.CreateClient();

		// The client wrote the first address itself; Render appended the second.
		using var response = await SendAsync(
			client, RemoteAddressPath, forwardedFor: "203.0.113.9, 198.51.100.7");

		Assert.Equal("198.51.100.7", await response.Content.ReadAsStringAsync(_cancellationToken));
	}

	private async Task<HttpResponseMessage> SendAsync(
		HttpClient client,
		string path,
		string? forwardedProto = null,
		string? forwardedFor = null)
	{
		var request = new HttpRequestMessage(HttpMethod.Get, path);
		request.Headers.Host = PublicHost;
		if (forwardedProto is not null)
		{
			request.Headers.Add("X-Forwarded-Proto", forwardedProto);
		}

		if (forwardedFor is not null)
		{
			request.Headers.Add("X-Forwarded-For", forwardedFor);
		}

		return await client.SendAsync(request, _cancellationToken);
	}

	// Test-only: answers with the client address the app sees. Added after the
	// app's own pipeline, so forwarded headers have already been applied, and
	// only reached for a path no app endpoint matches.
	private sealed class RemoteAddressEndpoint : IStartupFilter
	{
		public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
		{
			next(app);
			app.Run(async context =>
			{
				if (context.Request.Path != RemoteAddressPath)
				{
					context.Response.StatusCode = StatusCodes.Status404NotFound;
					return;
				}

				await context.Response.WriteAsync($"{context.Connection.RemoteIpAddress}");
			});
		};
	}
}
