namespace vetiflow.Server.Contracts.Staff;

// One active case on a clinician's list (build plan 4.5): enough to find it on the
// board, nothing more.
public class TeamCaseDto
{
	public Guid Id { get; set; }

	// "ER-2481".
	public required string CaseNumber { get; set; }

	public required string PatientName { get; set; }
}
