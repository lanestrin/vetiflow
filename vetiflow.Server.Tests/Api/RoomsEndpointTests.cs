using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// GET /api/rooms (build plan 4.3a). The database is shared with other tests,
// so these assert only on the rooms and cases each test saves.
public class RoomsEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task GetRooms_SignedOut_Returns401()
	{
		using var client = factory.CreateClient();

		var response = await client.GetAsync("/api/rooms", _cancellationToken);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Fact]
	public async Task GetRooms_PetParent_Returns403()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await client.GetAsync("/api/rooms", _cancellationToken);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
	}

	[Fact]
	public async Task GetRooms_ListsEachRoomByNameWithTheActiveCaseInIt()
	{
		var prefix = $"Order {Guid.NewGuid():N}";
		var inUse = new Room { Name = $"{prefix} A", Type = RoomType.Oxygen };
		var free = new Room { Name = $"{prefix} B", Type = RoomType.Exam };
		var leftByDischarge = new Room { Name = $"{prefix} C", Type = RoomType.ICU };
		var activeCase = TestData.Case(TestData.Patient(), inUse);
		var dischargedCase = TestData.Case(TestData.Patient(), leftByDischarge);
		dischargedCase.DischargedAt = DateTimeOffset.UtcNow;
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.Rooms.Add(free);
			dbContext.EmergencyCases.AddRange(activeCase, dischargedCase);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.GetAsync("/api/rooms", _cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var rooms = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var ids = rooms.EnumerateArray().Select(room => room.GetProperty("id").GetGuid()).ToList();
		Assert.True(ids.IndexOf(inUse.Id) < ids.IndexOf(free.Id));
		Assert.True(ids.IndexOf(free.Id) < ids.IndexOf(leftByDischarge.Id));
		var listed = Find(rooms, inUse.Id);
		Assert.Equal(inUse.Name, listed.GetProperty("name").GetString());
		Assert.Equal("oxygen", listed.GetProperty("type").GetString());
		Assert.Equal(activeCase.Id, listed.GetProperty("occupiedBy").GetProperty("id").GetGuid());
		Assert.Equal($"ER-{activeCase.CaseNumber}", listed.GetProperty("occupiedBy").GetProperty("caseNumber").GetString());
		Assert.Equal(JsonValueKind.Null, Find(rooms, free.Id).GetProperty("occupiedBy").ValueKind);
		Assert.Equal(JsonValueKind.Null, Find(rooms, leftByDischarge.Id).GetProperty("occupiedBy").ValueKind);
	}

	private static JsonElement Find(JsonElement rooms, Guid id) =>
		rooms.EnumerateArray().Single(room => room.GetProperty("id").GetGuid() == id);
}
