using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// A tag on a case (build plan 3.5a), as the add response and the case detail
// list it.
public class CaseTagDto
{
	public Guid Id { get; set; }

	public required string Text { get; set; }

	public CaseTagTone Tone { get; set; }

	public DateTimeOffset CreatedAt { get; set; }

	public CaseReferenceDto? CreatedBy { get; set; }
}
