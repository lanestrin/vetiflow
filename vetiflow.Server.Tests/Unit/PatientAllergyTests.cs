using vetiflow.Server.Models;
using vetiflow.Server.Tests.Infrastructure;

namespace vetiflow.Server.Tests.Unit;

// Allergy text from an intake is unverified, whatever it says, and never
// keeps an earlier verification (build plan 4.12a).
public class PatientAllergyTests
{
	[Theory]
	[InlineData("Penicillin")]
	[InlineData("None")]
	[InlineData("NKA")]
	public void RecordReportedAllergies_AnyText_IsUnknownOrUnverified(string text)
	{
		var patient = TestData.Patient();

		patient.RecordReportedAllergies($"  {text} ");

		Assert.Equal(AllergyStatus.UnknownOrUnverified, patient.AllergyStatus);
		Assert.Equal(text, patient.Allergies);
	}

	[Fact]
	public void RecordReportedAllergies_ClearsAnEarlierVerificationAndSource()
	{
		var patient = TestData.Patient();
		patient.AllergyStatus = AllergyStatus.NoKnownAllergies;
		patient.AllergySource = AllergySource.ClinicRecord;
		patient.AllergiesVerifiedAt = DateTimeOffset.UtcNow;
		patient.AllergiesVerifiedByStaffId = Guid.NewGuid();

		patient.RecordReportedAllergies("Chicken");

		Assert.Equal(AllergyStatus.UnknownOrUnverified, patient.AllergyStatus);
		Assert.Null(patient.AllergySource);
		Assert.Null(patient.AllergiesVerifiedAt);
		Assert.Null(patient.AllergiesVerifiedByStaffId);
	}

	[Theory]
	[InlineData(null)]
	[InlineData("")]
	[InlineData("   ")]
	public void RecordReportedAllergies_Blank_ChangesNothing(string? text)
	{
		var patient = TestData.Patient();
		patient.RecordReportedAllergies("Chicken");

		patient.RecordReportedAllergies(text);

		Assert.Equal(AllergyStatus.UnknownOrUnverified, patient.AllergyStatus);
		Assert.Equal("Chicken", patient.Allergies);
	}

	[Fact]
	public void NewPatient_IsNotRecorded()
	{
		Assert.Equal(AllergyStatus.NotRecorded, TestData.Patient().AllergyStatus);
	}

	[Theory]
	[InlineData("Penicillin", AllergyStatus.UnknownOrUnverified, "Penicillin")]
	[InlineData(" None ", AllergyStatus.UnknownOrUnverified, "None")]
	[InlineData("  ", AllergyStatus.NotRecorded, null)]
	[InlineData(null, AllergyStatus.NotRecorded, null)]
	public void RecordAllergiesAtIntake_SetsTheVisitsOwnRecord(string? text, AllergyStatus status, string? stored)
	{
		var emergencyCase = TestData.Case(TestData.Patient());

		emergencyCase.RecordAllergiesAtIntake(text);

		Assert.Equal(status, emergencyCase.AllergyStatusAtIntake);
		Assert.Equal(stored, emergencyCase.AllergiesAtIntake);
	}
}
