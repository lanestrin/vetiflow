using System.Net;
using System.Net.Http.Json;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

public class HealthEndpointTests(VetiFlowApiFactory factory)
{
	private record HealthResponse(string Status, string Database);

	[Fact]
	public async Task Get_WithDatabaseUp_ReportsHealthy()
	{
		var cancellationToken = TestContext.Current.CancellationToken;
		using var client = factory.CreateClient();

		var response = await client.GetAsync("/api/health", cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var body = await response.Content.ReadFromJsonAsync<HealthResponse>(cancellationToken);
		Assert.Equal(new HealthResponse("healthy", "connected"), body);
	}
}
