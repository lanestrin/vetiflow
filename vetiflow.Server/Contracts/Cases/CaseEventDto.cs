using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// One entry on the case timeline.
public class CaseEventDto
{
	public Guid Id { get; set; }

	public CaseEventType Type { get; set; }

	public required string Description { get; set; }

	public DateTimeOffset CreatedAt { get; set; }

	public CaseReferenceDto? CreatedBy { get; set; }
}
