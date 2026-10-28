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
}
