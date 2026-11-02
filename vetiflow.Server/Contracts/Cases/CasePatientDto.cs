using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// The patient on a case, for the case detail drawer.
public class CasePatientDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }

	public PatientSex? Sex { get; set; }

	public DateOnly? DateOfBirth { get; set; }

	// True when worked out from an age given at intake ("8 years").
	public bool DateOfBirthIsEstimated { get; set; }

	// Carried from visit to visit; clinical, never logged.
	public string? Allergies { get; set; }

	// What the allergy information amounts to (4.12a); only the verified
	// statuses carry a verifier and time.
	public AllergyStatus AllergyStatus { get; set; }

	public AllergySource? AllergySource { get; set; }

	public DateTimeOffset? AllergiesVerifiedAt { get; set; }

	public CaseReferenceDto? AllergiesVerifiedBy { get; set; }

	public string? CurrentMedications { get; set; }
}
