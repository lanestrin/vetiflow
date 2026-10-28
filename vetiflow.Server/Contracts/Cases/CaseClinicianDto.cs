namespace vetiflow.Server.Contracts.Cases;

// The one clinician a board card names: "JR Reed".
public class CaseClinicianDto
{
	public Guid Id { get; set; }

	// The last name.
	public required string ShortName { get; set; }

	public required string Initials { get; set; }
}
