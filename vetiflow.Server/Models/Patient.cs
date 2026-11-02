namespace vetiflow.Server.Models;

public enum PatientSex
{
	MaleIntact,
	MaleNeutered,
	FemaleIntact,
	FemaleSpayed
}

public class Patient
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string Name { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }

	// Null means not yet recorded.
	public PatientSex? Sex { get; set; }

	public DateOnly? DateOfBirth { get; set; }

	// True when the date of birth was worked out from an age given at intake.
	public bool DateOfBirthIsEstimated { get; set; }

	// Clinical text, carried to the next visit and checked again at each
	// intake (decided 2026-10-28). Never logged. Change it through
	// RecordReportedAllergies, so the status always matches (4.12a).
	public string? Allergies { get; set; }

	public AllergyStatus AllergyStatus { get; set; } = AllergyStatus.NotRecorded;

	public AllergySource? AllergySource { get; set; }

	// Set only for a verified status (NoKnownAllergies, DocumentedAllergies).
	public DateTimeOffset? AllergiesVerifiedAt { get; set; }

	public Guid? AllergiesVerifiedByStaffId { get; set; }

	public StaffMember? AllergiesVerifiedByStaff { get; set; }

	// Medicine and last dose, as last confirmed. Never logged.
	public string? CurrentMedications { get; set; }

	// Null for strays and owners not yet known.
	public Guid? OwnerId { get; set; }

	public Owner? Owner { get; set; }

	// Allergy text reported at an intake is unverified, whatever it says, and
	// replaces any earlier verification; a blank report changes nothing.
	public void RecordReportedAllergies(string? text)
	{
		if (string.IsNullOrWhiteSpace(text))
		{
			return;
		}

		Allergies = text.Trim();
		AllergyStatus = AllergyStatus.UnknownOrUnverified;
		AllergySource = null;
		AllergiesVerifiedAt = null;
		AllergiesVerifiedByStaffId = null;
		AllergiesVerifiedByStaff = null;
	}
}
