using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Api;

// New patient intake (build plan 4.1a): the prototype's intake dialog creates a
// case in Incoming with a provisional priority.
public class CaseIntakeEndpointTests(VetiFlowApiFactory factory)
{
	private const string IntakeUrl = "/api/cases/intake";

	private readonly CancellationToken _cancellationToken = TestContext.Current.CancellationToken;

	[Fact]
	public async Task Intake_NewPatient_CreatesProvisionalIncomingCase()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);
		var before = DateTimeOffset.UtcNow;

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new
		{
			petName = "Toby",
			species = "Dog",
			breed = "Terrier mix",
			age = "5 years",
			ownerName = "Jo Anne Mills",
			ownerPhone = UniquePhone(),
			chiefComplaint = "Acute vomiting",
			priority = "urgent",
			triageNotes = "Vomited four times since 6 AM.",
			treatmentAuthorization = "pending",
			referringClinic = "Lakeside Animal Clinic"
		}), _cancellationToken);

		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var result = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		var caseId = result.GetProperty("id").GetGuid();
		Assert.Equal($"/api/cases/{caseId}", response.Headers.Location?.AbsolutePath);
		Assert.StartsWith("ER-", result.GetProperty("caseNumber").GetString());

		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases
			.Include(c => c.Patient).ThenInclude(p => p.Owner)
			.Include(c => c.TriageAssessments).ThenInclude(t => t.AssessedByStaff)
			.Include(c => c.Events).ThenInclude(e => e.CreatedByStaff)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(CaseStage.Incoming, saved.Stage);
		Assert.Equal(CaseStatus.Unassigned, saved.Status);
		Assert.Equal(AcuityLevel.Urgent, saved.Acuity);
		Assert.InRange(saved.ArrivalTime, before, DateTimeOffset.UtcNow);
		Assert.Equal(saved.ArrivalTime, saved.StageEnteredAt);
		Assert.Equal("Acute vomiting", saved.PresentingComplaint);
		Assert.Equal(TreatmentAuthorization.Pending, saved.TreatmentAuthorization);
		Assert.Equal("Lakeside Animal Clinic", saved.ReferringClinic);

		var triage = Assert.Single(saved.TriageAssessments);
		Assert.Equal(AcuityLevel.Urgent, triage.Acuity);
		Assert.Equal("Vomited four times since 6 AM.", triage.RawIntakeNotes);
		Assert.Equal("Jordan", triage.AssessedByStaff?.FirstName);

		var arrived = Assert.Single(saved.Events);
		Assert.Equal(CaseEventType.Arrived, arrived.Type);
		Assert.Equal("Jordan", arrived.CreatedByStaff?.FirstName);

		Assert.Equal("Toby", saved.Patient.Name);
		Assert.Equal("Terrier mix", saved.Patient.Breed);
		Assert.Equal(DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-5), saved.Patient.DateOfBirth);
		Assert.True(saved.Patient.DateOfBirthIsEstimated);
		Assert.Equal("Jo Anne", saved.Patient.Owner?.FirstName);
		Assert.Equal("Mills", saved.Patient.Owner?.LastName);

	}

	// Decided 2026-10-28: a phone whose digits match an existing owner's reuses
	// that owner and keeps their stored details.
	[Fact]
	public async Task Intake_ReusesOwnerWithSamePhoneDigits()
	{
		var digits = UniqueDigits();
		var owner = TestData.Owner();
		owner.Phone = $"({digits[..3]}) {digits[3..6]}-{digits[6..]}";
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.Owners.Add(owner);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new
		{
			ownerName = "Someone Else",
			ownerPhone = $"{digits[..3]}.{digits[3..6]}.{digits[6..]}"
		}), _cancellationToken);

		var caseId = await CreatedCaseIdAsync(response);
		await using var check = factory.CreateDbContext();
		var saved = await check.EmergencyCases
			.Include(c => c.Patient).ThenInclude(p => p.Owner)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(owner.Id, saved.Patient.OwnerId);
		Assert.Equal(owner.LastName, saved.Patient.Owner!.LastName);
	}

	[Fact]
	public async Task Intake_RecordsAllergiesAndMedications()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new
		{
			allergies = "Penicillin",
			medications = "Carprofen 75 mg, last dose 7 AM"
		}), _cancellationToken);

		var caseId = await CreatedCaseIdAsync(response);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.Include(c => c.Patient)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal("Penicillin", saved.Patient.Allergies);
		Assert.Equal("Carprofen 75 mg, last dose 7 AM", saved.Patient.CurrentMedications);
		Assert.Equal("Penicillin", saved.AllergiesAtIntake);
		Assert.Equal("Carprofen 75 mg, last dose 7 AM", saved.MedicationsAtIntake);
		// Typed allergies are never verified by an intake (4.12a).
		Assert.Equal(AllergyStatus.UnknownOrUnverified, saved.Patient.AllergyStatus);
		Assert.Null(saved.Patient.AllergiesVerifiedAt);
		Assert.Equal(AllergyStatus.UnknownOrUnverified, saved.AllergyStatusAtIntake);
	}

	[Fact]
	public async Task Intake_NewPatientWithoutAllergies_IsNotRecorded()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new { allergies = (string?)null }), _cancellationToken);

		var caseId = await CreatedCaseIdAsync(response);
		await using var dbContext = factory.CreateDbContext();
		var saved = await dbContext.EmergencyCases.Include(c => c.Patient)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(AllergyStatus.NotRecorded, saved.Patient.AllergyStatus);
		Assert.Null(saved.Patient.Allergies);
		Assert.Equal(AllergyStatus.NotRecorded, saved.AllergyStatusAtIntake);
	}

	// A returning patient's verified record stays when the intake leaves
	// allergies blank, and is replaced by an unverified one when text is typed.
	[Theory]
	[InlineData(null, AllergyStatus.NoKnownAllergies, AllergyStatus.NotRecorded)]
	[InlineData("Chicken", AllergyStatus.UnknownOrUnverified, AllergyStatus.UnknownOrUnverified)]
	public async Task Intake_ReturningPatientWithVerifiedRecord(
		string? allergies, AllergyStatus patientStatus, AllergyStatus visitStatus)
	{
		var verifier = TestData.StaffMember(StaffRole.Veterinarian);
		var patient = TestData.Patient();
		patient.AllergyStatus = AllergyStatus.NoKnownAllergies;
		patient.AllergySource = AllergySource.ClinicRecord;
		patient.AllergiesVerifiedAt = DateTimeOffset.UtcNow;
		patient.AllergiesVerifiedByStaff = verifier;
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.AddRange(verifier, patient);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new
		{
			patientId = patient.Id,
			petName = (string?)null,
			species = (string?)null,
			allergies
		}), _cancellationToken);

		var caseId = await CreatedCaseIdAsync(response);
		await using var check = factory.CreateDbContext();
		var saved = await check.EmergencyCases.Include(c => c.Patient)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(patientStatus, saved.Patient.AllergyStatus);
		Assert.Equal(patientStatus == AllergyStatus.NoKnownAllergies, saved.Patient.AllergiesVerifiedByStaffId == verifier.Id);
		Assert.Equal(visitStatus, saved.AllergyStatusAtIntake);
	}

	// A returning patient: the medicines confirmed today replace the last ones;
	// allergies left blank keep what the patient already has.
	[Fact]
	public async Task Intake_ExistingPatient_CreatesCaseAndUpdatesMedications()
	{
		var patient = TestData.Patient();
		patient.RecordReportedAllergies("Chicken");
		patient.CurrentMedications = "Old medicine";
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.Patients.Add(patient);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new
		{
			patientId = patient.Id,
			petName = (string?)null,
			species = (string?)null,
			medications = "Gabapentin 100 mg"
		}), _cancellationToken);

		var caseId = await CreatedCaseIdAsync(response);
		await using var check = factory.CreateDbContext();
		var saved = await check.EmergencyCases.Include(c => c.Patient)
			.SingleAsync(c => c.Id == caseId, _cancellationToken);
		Assert.Equal(patient.Id, saved.PatientId);
		Assert.Equal(patient.Name, saved.Patient.Name);
		Assert.Equal("Chicken", saved.Patient.Allergies);
		Assert.Equal("Gabapentin 100 mg", saved.Patient.CurrentMedications);
		Assert.Null(saved.AllergiesAtIntake);
		Assert.Equal("Gabapentin 100 mg", saved.MedicationsAtIntake);
	}

	[Fact]
	public async Task Intake_ExistingPatientWithActiveCase_Returns409NamingIt()
	{
		var activeCase = TestData.Case(TestData.Patient());
		await using (var dbContext = factory.CreateDbContext())
		{
			dbContext.EmergencyCases.Add(activeCase);
			await dbContext.SaveChangesAsync(_cancellationToken);
		}
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new
		{
			patientId = activeCase.PatientId,
			petName = (string?)null,
			species = (string?)null
		}), _cancellationToken);

		Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
		Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		Assert.Equal(activeCase.Id, problem.GetProperty("activeCaseId").GetGuid());
		Assert.Equal($"ER-{activeCase.CaseNumber}", problem.GetProperty("activeCaseNumber").GetString());
	}

	[Fact]
	public async Task Intake_UnknownPatient_Returns404()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new
		{
			patientId = Guid.NewGuid(),
			petName = (string?)null,
			species = (string?)null
		}), _cancellationToken);

		Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
	}

	[Fact]
	public async Task Intake_MissingFields_Returns400()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, new { }, _cancellationToken);

		var errors = await ValidationErrorsAsync(response);
		foreach (var field in new[] { "PetName", "Species", "OwnerName", "OwnerPhone", "ChiefComplaint", "Priority" })
		{
			Assert.True(HasError(errors, field), $"Expected an error for {field}.");
		}
	}

	[Fact]
	public async Task Intake_UnreadableAge_Returns400()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new { age = "old" }), _cancellationToken);

		var errors = await ValidationErrorsAsync(response);
		Assert.True(HasError(errors, "Age"));
	}

	[Fact]
	public async Task Intake_OneWordOwnerName_Returns400()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new { ownerName = "Cher" }), _cancellationToken);

		var errors = await ValidationErrorsAsync(response);
		Assert.True(HasError(errors, "OwnerName"));
	}

	// Error responses name the field, never echo what was typed.
	[Fact]
	public async Task Intake_InvalidPhone_DoesNotEchoTheValue()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new { ownerPhone = "call 555 0199 x" }), _cancellationToken);

		var errors = await ValidationErrorsAsync(response);
		Assert.True(HasError(errors, "OwnerPhone"));
		Assert.DoesNotContain("555 0199", errors.GetRawText());
	}

	[Fact]
	public async Task Intake_SignedOut_Returns401()
	{
		using var client = factory.CreateClient();

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new { }), _cancellationToken);

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Fact]
	public async Task Intake_PetParent_Returns403()
	{
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.ParentEmail);

		var response = await client.PostAsJsonAsync(IntakeUrl, NewIntake(new { }), _cancellationToken);

		Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
	}

	[Fact]
	public async Task Intake_NotifiesConnectedBoards()
	{
		await using var hub = new HubConnectionBuilder()
			.WithUrl(new Uri(factory.Server.BaseAddress, "hubs/cases"), options =>
			{
				options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
				options.Transports = HttpTransportType.LongPolling;
			})
			.Build();
		// Other tests notify in parallel, so collect every id and look for ours.
		var notified = new System.Collections.Concurrent.ConcurrentDictionary<Guid, bool>();
		hub.On<Guid>("caseUpdated", caseId =>
		{
			notified[caseId] = true;
		});
		await hub.StartAsync(_cancellationToken);
		using var client = await factory.CreateSignedInClientAsync(DemoAccounts.TeamEmail);

		var caseId = await CreatedCaseIdAsync(await client.PostAsJsonAsync(IntakeUrl, NewIntake(new { }), _cancellationToken));

		var deadline = DateTime.UtcNow.AddSeconds(10);
		while (!notified.ContainsKey(caseId) && DateTime.UtcNow < deadline)
		{
			await Task.Delay(50, _cancellationToken);
		}
		Assert.True(notified.ContainsKey(caseId));
	}

	// A valid intake for a new patient; the overrides replace or add fields.
	private static Dictionary<string, object?> NewIntake(object overrides)
	{
		var intake = new Dictionary<string, object?>
		{
			["petName"] = "Pip",
			["species"] = "Cat",
			["ownerName"] = "Grace Park",
			["ownerPhone"] = UniquePhone(),
			["chiefComplaint"] = "Small paw abrasion",
			["priority"] = "stable"
		};
		foreach (var property in overrides.GetType().GetProperties())
		{
			intake[char.ToLowerInvariant(property.Name[0]) + property.Name[1..]] = property.GetValue(overrides);
		}
		return intake;
	}

	private static string UniqueDigits() => Random.Shared.NextInt64(2_000_000_000, 9_999_999_999).ToString();

	private static string UniquePhone()
	{
		var digits = UniqueDigits();
		return $"{digits[..3]}-{digits[3..6]}-{digits[6..]}";
	}

	private async Task<Guid> CreatedCaseIdAsync(HttpResponseMessage response)
	{
		Assert.Equal(HttpStatusCode.Created, response.StatusCode);
		var result = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		return result.GetProperty("id").GetGuid();
	}

	private static bool HasError(JsonElement errors, string field) =>
		errors.EnumerateObject().Any(error => error.Name.Contains(field, StringComparison.OrdinalIgnoreCase));

	private async Task<JsonElement> ValidationErrorsAsync(HttpResponseMessage response)
	{
		Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
		var problem = await response.Content.ReadFromJsonAsync<JsonElement>(_cancellationToken);
		return problem.GetProperty("errors");
	}
}
