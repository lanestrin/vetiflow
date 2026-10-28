using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// One acuity decision. Raw intake notes are clinical text: team members only,
// never logged or sent to the hub.
public class TriageAssessmentDto
{
	public Guid Id { get; set; }

	public AcuityLevel Acuity { get; set; }

	public string? RawIntakeNotes { get; set; }

	public DateTimeOffset AssessedAt { get; set; }

	public CaseReferenceDto? AssessedBy { get; set; }
}
