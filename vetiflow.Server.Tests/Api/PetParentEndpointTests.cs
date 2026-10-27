using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// A pet parent sees only their own pets (build plan S.18c). Each test makes
// a fresh owner with their own account, so other tests' rows never mix in.
public class PetParentEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task GetPets_ReturnsOnlyTheSignedInOwnersPets()
	{
		var owner = TestData.Owner();
		var rex = Pet(owner, "Rex");
		var nala = Pet(owner, "Nala");
		var someoneElsesPet = Pet(TestData.Owner(), "Not yours");
		await SaveAsync(rex, nala, someoneElsesPet);
		using var client = await SignedInOwnerAsync(owner);

		var pets = await GetPetsAsync(client);

		Assert.Equal(["Nala", "Rex"], pets.Select(pet => pet.GetProperty("name").GetString()));
	}

	[Fact]
	public async Task GetPets_MarksInCare()
	{
		var owner = TestData.Owner();
		var inCare = Pet(owner, "In care");
		var dischargedPet = Pet(owner, "Discharged");
		var neverAdmitted = Pet(owner, "Never admitted");
		var discharged = TestData.Case(dischargedPet);
		discharged.DischargedAt = DateTimeOffset.UtcNow;
		await SaveAsync(inCare, dischargedPet, neverAdmitted);
		await SaveCasesAsync(TestData.Case(inCare), discharged);
		using var client = await SignedInOwnerAsync(owner);

		var pets = (await GetPetsAsync(client)).ToDictionary(
			pet => pet.GetProperty("name").GetString()!,
			pet => pet.GetProperty("inCare").GetBoolean());

		Assert.Equal(
			new Dictionary<string, bool> { ["In care"] = true, ["Discharged"] = false, ["Never admitted"] = false },
			pets);
	}

	[Fact]
	public async Task GetPets_ListsInCareFirstThenByName()
	{
		var owner = TestData.Owner();
		var zara = Pet(owner, "Zara");
		var apollo = Pet(owner, "Apollo");
		var milo = Pet(owner, "Milo");
		await SaveAsync(zara, apollo, milo);
		await SaveCasesAsync(TestData.Case(zara));
		using var client = await SignedInOwnerAsync(owner);

		var pets = await GetPetsAsync(client);

		Assert.Equal(["Zara", "Apollo", "Milo"], pets.Select(pet => pet.GetProperty("name").GetString()));
	}

	[Fact]
	public async Task GetPets_NoPets_ReturnsEmptyList()
	{
		using var client = await SignedInOwnerAsync(TestData.Owner());

		var pets = await GetPetsAsync(client);

		Assert.Empty(pets);
	}

	[Fact]
	public async Task GetPets_SignedOut_Returns401Problem()
	{
		using var client = factory.CreateClient();

		var response = await client.GetAsync("/api/pet-parent/pets", _cancellationToken);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	[Fact]
	public async Task GetPets_AsTeamMember_Returns403Problem()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.GetAsync("/api/pet-parent/pets", _cancellationToken);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	// Only name, species and in-care: nothing to look a pet up by, nothing about
	// the owner, nothing clinical.
	[Fact]
	public async Task GetPets_NeverReturnsIdsOrOwnerDetails()
	{
		var owner = TestData.Owner();
		var pet = Pet(owner, "Biscuit");
		await SaveAsync(pet);
		await SaveCasesAsync(TestData.Case(pet));
		using var client = await SignedInOwnerAsync(owner);

		var response = await client.GetAsync("/api/pet-parent/pets", _cancellationToken);

		var body = await response.Content.ReadAsStringAsync(_cancellationToken);
		var listed = Assert.Single(JsonSerializer.Deserialize<JsonElement[]>(body)!);
		Assert.Equal(
			["inCare", "name", "species"],
			listed.EnumerateObject().Select(property => property.Name).Order());
		Assert.DoesNotContain(pet.Id.ToString(), body);
		Assert.DoesNotContain(owner.Phone!, body);
		Assert.DoesNotContain(owner.Email!, body);
	}

	private static Patient Pet(Owner owner, string name)
	{
		var patient = TestData.Patient();
		patient.Name = name;
		patient.Owner = owner;
		return patient;
	}

	private async Task SaveAsync(params Patient[] patients)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.Patients.AddRange(patients);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private async Task SaveCasesAsync(params EmergencyCase[] cases)
	{
		await using var dbContext = factory.CreateDbContext();
		foreach (var emergencyCase in cases)
		{
			dbContext.Attach(emergencyCase.Patient);
			dbContext.EmergencyCases.Add(emergencyCase);
		}
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	// A pet parent account for this owner with the demo password, signed in
	// through the real endpoint.
	private async Task<HttpClient> SignedInOwnerAsync(Owner owner)
	{
		var account = TestData.PetParentAccount(owner);
		account.PasswordHash = new PasswordHasher<Account>().HashPassword(account, DbSeeder.DemoPassword);
		await using (var dbContext = factory.CreateDbContext())
		{
			// An owner already saved with their pets is linked by id; a new one
			// is saved with the account.
			if (await dbContext.Owners.AnyAsync(saved => saved.Id == owner.Id, _cancellationToken))
			{
				account.Owner = null;
				account.OwnerId = owner.Id;
			}
			dbContext.Accounts.Add(account);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}

		return await factory.CreateClient().SignInAsync(account.Email!);
	}

	private async Task<JsonElement[]> GetPetsAsync(HttpClient client) =>
		(await client.GetFromJsonAsync<JsonElement[]>("/api/pet-parent/pets", _cancellationToken))!;
}
