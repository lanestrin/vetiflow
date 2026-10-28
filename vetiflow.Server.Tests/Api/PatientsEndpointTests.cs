using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// Patient records for hospital team members (build plan 4.6a). The tests share
// one database, so each one names its rows with its own unique text and
// searches for that.
public class PatientsEndpointTests(VetiFlowApiFactory factory)
{
	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task SearchPatients_MatchesPetOrOwnerName()
	{
		var unique = Unique();
		var byPetName = PatientNamed($"Rex{unique}");
		var byOwnerName = PatientNamed("Nala", OwnerNamed("Dana", $"Cole{unique}"));
		var neither = PatientNamed("Other", OwnerNamed("Someone", "Else"));
		await SaveAsync(byPetName, byOwnerName, neither);
		using var client = await TeamClientAsync();

		var byPet = await SearchAsync(client, $"rex{unique}");
		var byOwnerFullName = await SearchAsync(client, $"dana cole{unique}");

		Assert.Equal([byPetName.Id], byPet.Select(Id));
		Assert.Equal([byOwnerName.Id], byOwnerFullName.Select(Id));
	}

	[Fact]
	public async Task SearchPatients_IncludesPatientsWithNoOwner()
	{
		var unique = Unique();
		var stray = PatientNamed($"Stray{unique}");
		await SaveAsync(stray);
		using var client = await TeamClientAsync();

		var found = Assert.Single(await SearchAsync(client, unique));

		Assert.Equal(stray.Id, Id(found));
		Assert.Equal(JsonValueKind.Null, found.GetProperty("ownerId").ValueKind);
		Assert.Equal(JsonValueKind.Null, found.GetProperty("ownerName").ValueKind);
	}

	[Fact]
	public async Task SearchPatients_OrdersByPetNameThenOwnerLastName()
	{
		var unique = Unique();
		var zed = PatientNamed($"Zed{unique}");
		var maxYoung = PatientNamed($"Max{unique}", OwnerNamed("Al", "Young"));
		var maxAdams = PatientNamed($"Max{unique}", OwnerNamed("Bo", "Adams"));
		await SaveAsync(zed, maxYoung, maxAdams);
		using var client = await TeamClientAsync();

		var patients = await SearchAsync(client, unique);

		Assert.Equal([maxAdams.Id, maxYoung.Id, zed.Id], patients.Select(Id));
	}

	[Fact]
	public async Task SearchPatients_ReturnsAtMost25()
	{
		var unique = Unique();
		await SaveAsync(Enumerable.Range(0, 30).Select(index => PatientNamed($"Pet{index}{unique}")).ToArray());
		using var client = await TeamClientAsync();

		var patients = await SearchAsync(client, unique);

		Assert.Equal(25, patients.Count);
	}

	[Fact]
	public async Task SearchPatients_MarksInCare()
	{
		var unique = Unique();
		var inCare = PatientNamed($"InCare{unique}");
		var dischargedPet = PatientNamed($"Discharged{unique}");
		var discharged = TestData.Case(dischargedPet);
		discharged.DischargedAt = DateTimeOffset.UtcNow;
		// Saving the cases saves their patients too.
		await SaveCasesAsync(TestData.Case(inCare), discharged);
		using var client = await TeamClientAsync();

		var patients = (await SearchAsync(client, unique)).ToDictionary(Id, patient => patient.GetProperty("inCare").GetBoolean());

		Assert.Equal(new Dictionary<Guid, bool> { [inCare.Id] = true, [dischargedPet.Id] = false }, patients);
	}

	[Fact]
	public async Task SearchPatients_LeavesOutOwnerContactDetails()
	{
		var unique = Unique();
		var owner = TestData.Owner();
		var patient = PatientNamed($"Buddy{unique}", owner);
		await SaveAsync(patient);
		using var client = await TeamClientAsync();

		var response = await client.GetAsync($"/api/patients?search={unique}", _cancellationToken);
		var body = await response.Content.ReadAsStringAsync(_cancellationToken);

		Assert.Contains($"Owner {owner.LastName}", body);
		Assert.DoesNotContain(owner.Phone!, body);
		Assert.DoesNotContain(owner.Email!, body);
	}

	[Theory]
	[InlineData("")]
	[InlineData("?search=x")]
	public async Task SearchPatients_TooShortOrMissing_ReturnsValidationProblem(string query)
	{
		using var client = await TeamClientAsync();

		var response = await client.GetAsync($"/api/patients{query}", _cancellationToken);

		await AssertValidationProblemAsync(response, "search");
	}

	[Fact]
	public async Task GetPatient_ReturnsOwner()
	{
		var owner = TestData.Owner();
		var patient = TestData.Patient();
		patient.Owner = owner;
		patient.Sex = PatientSex.FemaleSpayed;
		patient.DateOfBirth = new DateOnly(2019, 4, 2);
		await SaveAsync(patient);
		using var client = await TeamClientAsync();

		var found = await client.GetFromJsonAsync<JsonElement>($"/api/patients/{patient.Id}", _cancellationToken);

		Assert.Equal(patient.Name, found.GetProperty("name").GetString());
		Assert.Equal("femaleSpayed", found.GetProperty("sex").GetString());
		Assert.Equal("2019-04-02", found.GetProperty("dateOfBirth").GetString());
		var foundOwner = found.GetProperty("owner");
		Assert.Equal(owner.Id, foundOwner.GetProperty("id").GetGuid());
		Assert.Equal(owner.Phone, foundOwner.GetProperty("phone").GetString());
	}

	[Fact]
	public async Task GetPatient_Unknown_ReturnsNotFound()
	{
		using var client = await TeamClientAsync();

		var response = await client.GetAsync($"/api/patients/{Guid.NewGuid()}", _cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task CreatePatient_WithoutOwner_ReturnsCreated()
	{
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/patients",
			new { name = " Biscuit ", species = "Cat", breed = "", sex = "maleNeutered", dateOfBirth = "2021-06-15" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var created = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var id = created.GetProperty("id").GetGuid();
		Assert.EndsWith($"/api/patients/{id}", response.Headers.Location?.ToString(), StringComparison.OrdinalIgnoreCase);
		Assert.Equal(JsonValueKind.Null, created.GetProperty("owner").ValueKind);
		var saved = await FindAsync(id);
		Assert.Equal(("Biscuit", "Cat", PatientSex.MaleNeutered, new DateOnly(2021, 6, 15)), (saved.Name, saved.Species, saved.Sex, saved.DateOfBirth));
		Assert.Null(saved.Breed);
		Assert.Null(saved.OwnerId);
	}

	[Fact]
	public async Task CreatePatient_WithOwner_ReturnsOwner()
	{
		var owner = TestData.Owner();
		await SaveOwnersAsync(owner);
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/patients",
			new { name = "Biscuit", species = "Cat", ownerId = owner.Id },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var created = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal(owner.LastName, created.GetProperty("owner").GetProperty("lastName").GetString());
		Assert.Equal(owner.Id, (await FindAsync(created.GetProperty("id").GetGuid())).OwnerId);
	}

	[Fact]
	public async Task CreatePatient_UnknownOwner_ReturnsValidationProblem()
	{
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/patients",
			new { name = "Biscuit", species = "Cat", ownerId = Guid.NewGuid() },
			_cancellationToken);

		await AssertValidationProblemAsync(response, "ownerId");
	}

	[Theory]
	[InlineData("""{"species":"Cat"}""", "name")]
	[InlineData("""{"name":" ","species":"Cat"}""", "name")]
	[InlineData("""{"name":"Biscuit","species":""}""", "species")]
	[InlineData("""{"name":"Biscuit","species":"Cat","sex":2}""", "sex")]
	[InlineData("""{"name":"Biscuit","species":"Cat","sex":"neutered"}""", "sex")]
	[InlineData("""{"name":"Biscuit","species":"Cat","dateOfBirth":"15/06/2021"}""", "dateOfBirth")]
	public async Task CreatePatient_InvalidFields_ReturnsValidationProblem(string body, string field)
	{
		using var client = await TeamClientAsync();

		var response = await PostJsonAsync(client, "/api/patients", body);

		await AssertValidationProblemAsync(response, field);
	}

	[Fact]
	public async Task CreatePatient_TooLong_ReturnsValidationProblem()
	{
		using var client = await TeamClientAsync();

		var response = await client.PostAsJsonAsync(
			"/api/patients",
			new { name = "Biscuit", species = new string('a', 51) },
			_cancellationToken);

		await AssertValidationProblemAsync(response, "species");
	}

	[Fact]
	public async Task CreatePatient_FutureDateOfBirth_ReturnsValidationProblem()
	{
		using var client = await TeamClientAsync();
		var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

		var response = await client.PostAsJsonAsync(
			"/api/patients",
			new { name = "Biscuit", species = "Cat", dateOfBirth = tomorrow },
			_cancellationToken);

		await AssertValidationProblemAsync(response, "dateOfBirth");
	}

	[Fact]
	public async Task UpdatePatient_ReplacesFieldsAndClearsOwner()
	{
		var patient = TestData.Patient();
		patient.Owner = TestData.Owner();
		patient.Sex = PatientSex.MaleIntact;
		await SaveAsync(patient);
		using var client = await TeamClientAsync();

		var response = await client.PutAsJsonAsync(
			$"/api/patients/{patient.Id}",
			new { name = "Renamed", species = "Rabbit" },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var saved = await FindAsync(patient.Id);
		Assert.Equal(("Renamed", "Rabbit"), (saved.Name, saved.Species));
		Assert.Null(saved.Breed);
		Assert.Null(saved.Sex);
		Assert.Null(saved.OwnerId);
	}

	[Fact]
	public async Task UpdatePatient_SetsOwner()
	{
		var patient = TestData.Patient();
		var owner = TestData.Owner();
		await SaveAsync(patient);
		await SaveOwnersAsync(owner);
		using var client = await TeamClientAsync();

		var response = await client.PutAsJsonAsync(
			$"/api/patients/{patient.Id}",
			new { name = patient.Name, species = patient.Species, ownerId = owner.Id },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		Assert.Equal(owner.Id, (await FindAsync(patient.Id)).OwnerId);
	}

	[Fact]
	public async Task UpdatePatient_UnknownOwner_KeepsThePatientAsItWas()
	{
		var patient = TestData.Patient();
		await SaveAsync(patient);
		using var client = await TeamClientAsync();

		var response = await client.PutAsJsonAsync(
			$"/api/patients/{patient.Id}",
			new { name = "Renamed", species = "Cat", ownerId = Guid.NewGuid() },
			_cancellationToken);

		await AssertValidationProblemAsync(response, "ownerId");
		Assert.Equal(patient.Name, (await FindAsync(patient.Id)).Name);
	}

	[Fact]
	public async Task UpdatePatient_Unknown_ReturnsNotFound()
	{
		using var client = await TeamClientAsync();

		var response = await client.PutAsJsonAsync(
			$"/api/patients/{Guid.NewGuid()}",
			new { name = "Biscuit", species = "Cat" },
			_cancellationToken);

		AssertProblemStatus(response, HttpStatusCode.NotFound);
	}

	[Fact]
	public async Task UpdatePatient_ActiveCase_BroadcastsCaseUpdated()
	{
		var patient = TestData.Patient();
		var activeCase = TestData.Case(patient);
		await SaveCasesAsync(activeCase);
		await using var hub = await ConnectHubAsync();
		var notified = WaitForCaseUpdated(hub, activeCase.Id);
		using var client = await TeamClientAsync();

		await client.PutAsJsonAsync(
			$"/api/patients/{patient.Id}",
			new { name = "Renamed", species = patient.Species },
			_cancellationToken);

		await notified.WaitAsync(TimeSpan.FromSeconds(10), _cancellationToken);
	}

	[Fact]
	public async Task UpdatePatient_DischargedCaseOnly_SendsNothing()
	{
		var patient = TestData.Patient();
		var dischargedCase = TestData.Case(patient);
		dischargedCase.DischargedAt = DateTimeOffset.UtcNow;
		await SaveCasesAsync(dischargedCase);
		await using var hub = await ConnectHubAsync();
		var notified = WaitForCaseUpdated(hub, dischargedCase.Id);
		using var client = await TeamClientAsync();

		var response = await client.PutAsJsonAsync(
			$"/api/patients/{patient.Id}",
			new { name = "Renamed", species = patient.Species },
			_cancellationToken);

		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		var finished = await Task.WhenAny(notified, Task.Delay(TimeSpan.FromSeconds(1), _cancellationToken));
		Assert.NotSame(notified, finished);
	}

	[Theory]
	[MemberData(nameof(Routes))]
	public async Task PatientEndpoints_SignedOut_Return401(string method, string path)
	{
		using var client = factory.CreateClient();

		var response = await SendAsync(client, method, path);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Theory]
	[MemberData(nameof(Routes))]
	public async Task PatientEndpoints_PetParent_Return403(string method, string path)
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await SendAsync(client, method, path);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
	}

	public static TheoryData<string, string> Routes => new()
	{
		{ "GET", "/api/patients?search=Buddy" },
		{ "GET", $"/api/patients/{Guid.NewGuid()}" },
		{ "POST", "/api/patients" },
		{ "PUT", $"/api/patients/{Guid.NewGuid()}" }
	};

	private Task<HttpResponseMessage> SendAsync(HttpClient client, string method, string path)
	{
		var request = new HttpRequestMessage(new HttpMethod(method), path);
		if (method is "POST" or "PUT")
		{
			request.Content = JsonContent.Create(new { name = "Biscuit", species = "Cat" });
		}

		return client.SendAsync(request, _cancellationToken);
	}

	private async Task<HubConnection> ConnectHubAsync()
	{
		var hub = new HubConnectionBuilder()
			.WithUrl(new Uri(factory.Server.BaseAddress, "hubs/cases"), options =>
			{
				options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
				options.Transports = HttpTransportType.LongPolling;
			})
			.Build();
		await hub.StartAsync(_cancellationToken);
		return hub;
	}

	// Other tests update cases in parallel, so this waits for one case only.
	private static Task WaitForCaseUpdated(HubConnection hub, Guid caseId)
	{
		var notified = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
		hub.On<Guid>("caseUpdated", updatedCaseId =>
		{
			if (updatedCaseId == caseId)
			{
				notified.TrySetResult();
			}
		});
		return notified.Task;
	}

	private Task<HttpClient> TeamClientAsync() => factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

	private async Task<List<JsonElement>> SearchAsync(HttpClient client, string text) =>
		(await client.GetFromJsonAsync<List<JsonElement>>(
			$"/api/patients?search={Uri.EscapeDataString(text)}",
			_cancellationToken))!;

	private Task<HttpResponseMessage> PostJsonAsync(HttpClient client, string path, string body) =>
		client.PostAsync(path, new StringContent(body, System.Text.Encoding.UTF8, "application/json"), _cancellationToken);

	private async Task AssertValidationProblemAsync(HttpResponseMessage response, string field)
	{
		AssertProblemStatus(response, HttpStatusCode.BadRequest);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var fields = problem.GetProperty("errors").EnumerateObject().Select(error => error.Name);
		Assert.Contains(fields, name => name.Contains(field, StringComparison.OrdinalIgnoreCase));
	}

	private static void AssertProblemStatus(HttpResponseMessage response, HttpStatusCode status)
	{
		Assert.Equal(status, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
	}

	private static Guid Id(JsonElement patient) => patient.GetProperty("id").GetGuid();

	private static Patient PatientNamed(string name, Owner? owner = null) => new()
	{
		Name = name,
		Species = "Dog",
		Owner = owner
	};

	private static Owner OwnerNamed(string firstName, string lastName) => new()
	{
		FirstName = firstName,
		LastName = lastName
	};

	private static string Unique() => Guid.NewGuid().ToString("N")[..8];

	private async Task<Patient> FindAsync(Guid id)
	{
		await using var dbContext = factory.CreateDbContext();
		return await dbContext.Patients.SingleAsync(patient => patient.Id == id, _cancellationToken);
	}

	private async Task SaveAsync(params Patient[] patients)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.Patients.AddRange(patients);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private async Task SaveOwnersAsync(params Owner[] owners)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.Owners.AddRange(owners);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}

	private async Task SaveCasesAsync(params EmergencyCase[] cases)
	{
		await using var dbContext = factory.CreateDbContext();
		dbContext.EmergencyCases.AddRange(cases);
		await dbContext.SaveChangesAsync(_cancellationToken);
	}
}
