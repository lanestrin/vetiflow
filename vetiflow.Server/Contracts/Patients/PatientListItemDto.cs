namespace vetiflow.Server.Contracts.Patients;

// A patient in search results: enough to tell patients apart and pick one.
// The owner's contact details are left out; PatientDto carries them.
public class PatientListItemDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }

	// Both null when the patient has no owner (a stray, or not known yet).
	public Guid? OwnerId { get; set; }

	public string? OwnerName { get; set; }

	// Has a case that is not discharged.
	public bool InCare { get; set; }
}
