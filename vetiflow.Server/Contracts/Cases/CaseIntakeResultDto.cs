namespace vetiflow.Server.Contracts.Cases;

// The case an intake created.
public class CaseIntakeResultDto
{
	public Guid Id { get; set; }

	// "ER-2489".
	public required string CaseNumber { get; set; }

	public Guid PatientId { get; set; }
}
