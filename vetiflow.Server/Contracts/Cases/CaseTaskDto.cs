using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// A task or blocker on a case, open or resolved.
public class CaseTaskDto
{
	public Guid Id { get; set; }

	public CaseTaskType Type { get; set; }

	public required string Description { get; set; }

	public CaseTaskStatus Status { get; set; }

	public DateTimeOffset? DueAt { get; set; }

	public CaseReferenceDto? AssignedTo { get; set; }

	public DateTimeOffset CreatedAt { get; set; }

	public CaseReferenceDto? CreatedBy { get; set; }

	public DateTimeOffset? ResolvedAt { get; set; }

	public CaseReferenceDto? ResolvedBy { get; set; }
}
