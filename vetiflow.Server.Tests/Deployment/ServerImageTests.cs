using System.Net;
using System.Net.Http.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using DotNet.Testcontainers.Images;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Deployment;

// Builds vetiflow.Server/Dockerfile and starts it the way Render does, so CI
// proves the exact image Render will run before Render deploys it. Each test
// builds the image; Docker's layer cache makes every build after the first fast.
public class ServerImageTests
{
	private const int RenderPort = 8080;

	// Port 1 inside the container: nothing listens there, so connecting fails
	// fast. The healthy path is covered in-process by HealthEndpointTests.
	private const string UnreachableDatabase =
		"Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	private record HealthResponse(string Status, string Database);

	[Fact]
	public async Task ServerImage_StartsOnRenderPort_AndAnswersHealth()
	{
		await WithRunningContainerAsync(async container =>
		{
			using var client = new HttpClient
			{
				BaseAddress = new Uri($"http://{container.Hostname}:{container.GetMappedPublicPort(RenderPort)}")
			};
			var response = await client.GetAsync("/api/health", _cancellationToken);

			Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
			var body = await response.Content.ReadFromJsonAsync<HealthResponse>(_cancellationToken);
			Assert.Equal(new HealthResponse("unhealthy", "disconnected"), body);
		});
	}

	// Kestrel enforces the body limit, and the in-process TestServer does not,
	// so only the real image can show it.
	[Fact]
	public async Task ServerImage_OversizedBody_ReturnsPayloadTooLargeProblem()
	{
		const int maxRequestBodyBytes = 1024 * 1024;

		await WithRunningContainerAsync(async container =>
		{
			using var client = new HttpClient
			{
				BaseAddress = new Uri($"http://{container.Hostname}:{container.GetMappedPublicPort(RenderPort)}")
			};
			var stageUrl = $"/api/cases/{Guid.NewGuid()}/stage";

			var oversized = await client.PatchAsync(stageUrl, JsonBody(maxRequestBodyBytes + 1), _cancellationToken);
			var withinLimit = await client.PatchAsync(stageUrl, JsonBody(maxRequestBodyBytes), _cancellationToken);

			Assert.Equal(HttpStatusCode.RequestEntityTooLarge, oversized.StatusCode);
			Assert.Equal("application/problem+json", oversized.Content.Headers.ContentType?.MediaType);
			// The database is unreachable here, so a body within the limit fails
			// later, on the query; what matters is that it was not refused as too large.
			Assert.NotEqual(HttpStatusCode.RequestEntityTooLarge, withinLimit.StatusCode);
		});
	}

	[Fact]
	public async Task ServerImage_RunsAsNonRootUser()
	{
		await WithRunningContainerAsync(async container =>
		{
			var result = await container.ExecAsync(["id", "-u"], _cancellationToken);

			Assert.Equal(0, result.ExitCode);
			Assert.NotEqual("0", result.Stdout.Trim());
		});
	}

	// A stage update padded to exactly the given number of bytes.
	private static ByteArrayContent JsonBody(int totalBytes)
	{
		const string prefix = """{"stage":"treatment","padding":""";
		const string suffix = "\"}";
		var json = prefix + new string('x', totalBytes - prefix.Length - suffix.Length) + suffix;
		var content = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(json));
		content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
		return content;
	}

	private async Task WithRunningContainerAsync(Func<IContainer, Task> test)
	{
		var image = new ImageFromDockerfileBuilder()
			.WithDockerfileDirectory(CommonDirectoryPath.GetGitDirectory(), "vetiflow.Server")
			.WithDockerfile("Dockerfile")
			.WithName($"vetiflow-server-test:{Guid.NewGuid():N}")
			.WithCleanUp(true)
			.Build();

		try
		{
			await image.CreateAsync(_cancellationToken);
		}
		catch (DockerUnavailableException) when (
			Environment.GetEnvironmentVariable(PostgresServer.ConnectionStringVariable) is not null)
		{
			Assert.Skip($"Docker is not available; {PostgresServer.ConnectionStringVariable} runs the other tests without it.");
		}

		try
		{
			await using var container = new ContainerBuilder(image)
				.WithEnvironment("PORT", RenderPort.ToString())
				.WithEnvironment("ConnectionStrings__VetiFlowDatabase", UnreachableDatabase)
				.WithPortBinding(RenderPort, true)
				.WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(request => request
					.ForPort(RenderPort)
					.ForPath("/api/health")
					.ForStatusCode(HttpStatusCode.ServiceUnavailable)))
				.Build();

			await container.StartAsync(_cancellationToken);

			await test(container);
		}
		finally
		{
			await image.DeleteAsync(CancellationToken.None);
		}
	}
}
