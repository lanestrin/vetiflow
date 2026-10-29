using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// GET and PUT /api/staff/me/status (build plan 2.21a). Each test signs in as a
// staff member of its own, so no test changes the demo team member.
public class StaffStatusEndpointTests(VetiFlowApiFactory factory)
{
	private const string Route = "/api/staff/me/status";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task GetMyStatus_AsClinician_ReturnsIt()
	{
		var staffMember = TestData.StaffMember(StaffRole.Technician);
		staffMember.Status = StaffStatus.AtLimit;
		using var client = await SignInAsync(staffMember);

		var response = await client.GetAsync(Route, _cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var body = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal("atLimit", body.GetProperty("status").GetString());
	}

	[Fact]
	public async Task PutMyStatus_SavesIt_AndGetReturnsIt()
	{
		var staffMember = TestData.StaffMember(StaffRole.Veterinarian);
		using var client = await SignInAsync(staffMember);

		var response = await client.PutAsJsonAsync(Route, new { status = "busy" }, _cancellationToken);

		Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
		Assert.Equal(StaffStatus.Busy, await StoredStatusAsync(staffMember.Id));
		var body = await client.GetFromJsonAsync<JsonElement>(Route, _cancellationToken);
		Assert.Equal("busy", body.GetProperty("status").GetString());
	}

	[Fact]
	public async Task PutMyStatus_ChangesOnlyMyRecord()
	{
		var colleague = TestData.StaffMember(StaffRole.Veterinarian);
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.StaffMembers.Add(colleague);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = await SignInAsync(TestData.StaffMember(StaffRole.Technician));

		await client.PutAsJsonAsync(Route, new { status = "available" }, _cancellationToken);

		Assert.Equal(StaffStatus.Unavailable, await StoredStatusAsync(colleague.Id));
	}

	[Theory]
	[InlineData("""{ "status": "sleeping" }""")]
	[InlineData("""{ "status": 1 }""")]
	public async Task PutMyStatus_UnknownOrNumericValue_Returns400(string json)
	{
		var staffMember = TestData.StaffMember(StaffRole.Veterinarian);
		using var client = await SignInAsync(staffMember);

		var response = await client.PutAsync(
			Route,
			new StringContent(json, Encoding.UTF8, "application/json"),
			_cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.BadRequest);
		Assert.Equal(StaffStatus.Unavailable, await StoredStatusAsync(staffMember.Id));
	}

	[Fact]
	public async Task PutMyStatus_MissingStatus_Returns400()
	{
		using var client = await SignInAsync(TestData.StaffMember(StaffRole.Veterinarian));

		var response = await client.PutAsJsonAsync(Route, new { }, _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.BadRequest);
	}

	[Fact]
	public async Task MyStatus_SignedOut_Returns401()
	{
		using var client = factory.CreateClient();

		AssertProblemStatus(await client.GetAsync(Route, _cancellationToken), HttpStatusCode.Unauthorized);
		AssertProblemStatus(
			await client.PutAsJsonAsync(Route, new { status = "busy" }, _cancellationToken),
			HttpStatusCode.Unauthorized);
	}

	[Fact]
	public async Task MyStatus_AsPetParent_Returns403()
	{
		using var client = await factory.CreateClient().SignInAsync(DemoAccounts.ParentEmail);

		AssertProblemStatus(await client.GetAsync(Route, _cancellationToken), HttpStatusCode.Forbidden);
		AssertProblemStatus(
			await client.PutAsJsonAsync(Route, new { status = "busy" }, _cancellationToken),
			HttpStatusCode.Forbidden);
	}

	[Fact]
	public async Task MyStatus_NotAClinician_Returns403()
	{
		var staffMember = TestData.StaffMember(StaffRole.Receptionist);
		using var client = await SignInAsync(staffMember);

		AssertProblemStatus(await client.GetAsync(Route, _cancellationToken), HttpStatusCode.Forbidden);
		AssertProblemStatus(
			await client.PutAsJsonAsync(Route, new { status = "busy" }, _cancellationToken),
			HttpStatusCode.Forbidden);
		Assert.Equal(StaffStatus.Unavailable, await StoredStatusAsync(staffMember.Id));
	}

	// Saves the staff member with a demo-password account and signs in as them.
	private async Task<HttpClient> SignInAsync(StaffMember staffMember)
	{
		var account = TestData.TeamMemberAccount(staffMember);
		account.PasswordHash = new PasswordHasher<Account>().HashPassword(account, DbSeeder.DemoPassword);
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.Accounts.Add(account);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}

		return await factory.CreateClient().SignInAsync(account.Email!);
	}

	private async Task<StaffStatus> StoredStatusAsync(Guid staffMemberId)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.StaffMembers
			.Where(staff => staff.Id == staffMemberId)
			.Select(staff => staff.Status)
			.SingleAsync(_cancellationToken);
	}

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}
}
