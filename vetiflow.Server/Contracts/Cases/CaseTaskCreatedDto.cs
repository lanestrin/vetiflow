using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// The task just added to a case (build plan 4.4a).
public class CaseTaskCreatedDto
{
	public Guid Id { get; set; }

	public CaseTaskType Type { get; set; }

	public required string Description { get; set; }

	public CaseTaskStatus Status { get; set; }

	public DateTimeOffset? DueAt { get; set; }

	public CaseReferenceDto? AssignedTo { get; set; }

	public DateTimeOffset CreatedAt { get; set; }

	public CaseReferenceDto? CreatedBy { get; set; }
}
