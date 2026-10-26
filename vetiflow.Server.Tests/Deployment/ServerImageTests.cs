using System.Net;
using System.Net.Http.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using DotNet.Testcontainers.Images;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Deployment;

// Builds vetiflow.Server/Dockerfile and starts it the way Render does, so CI
// proves the exact image Render will run before Render deploys it.
public class ServerImageTests
{
	private const int RenderPort = 8080;

	// Port 1 inside the container: nothing listens there, so connecting fails
	// fast. The healthy path is covered in-process by HealthEndpointTests.
	private const string UnreachableDatabase =
		"Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2";

	private record HealthResponse(string Status, string Database);

	[Fact]
	public async Task ServerImage_StartsOnRenderPort_AndAnswersHealth()
	{
		var cancellationToken = TestContext.Current.CancellationToken;
		var image = new ImageFromDockerfileBuilder()
			.WithDockerfileDirectory(CommonDirectoryPath.GetGitDirectory(), "vetiflow.Server")
			.WithDockerfile("Dockerfile")
			.WithName($"vetiflow-server-test:{Guid.NewGuid():N}")
			.WithCleanUp(true)
			.Build();

		try
		{
			await image.CreateAsync(cancellationToken);
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

			await container.StartAsync(cancellationToken);

			using var client = new HttpClient
			{
				BaseAddress = new Uri($"http://{container.Hostname}:{container.GetMappedPublicPort(RenderPort)}")
			};
			var response = await client.GetAsync("/api/health", cancellationToken);

			Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
			var body = await response.Content.ReadFromJsonAsync<HealthResponse>(cancellationToken);
			Assert.Equal(new HealthResponse("unhealthy", "disconnected"), body);
		}
		finally
		{
			await image.DeleteAsync(CancellationToken.None);
		}
	}
}
