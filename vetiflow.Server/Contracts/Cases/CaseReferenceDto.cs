namespace vetiflow.Server.Contracts.Cases;

// A staff member or room on a case: enough to show and link it, nothing more.
public class CaseReferenceDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }
}
