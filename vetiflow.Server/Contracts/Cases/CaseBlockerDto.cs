namespace vetiflow.Server.Contracts.Cases;

// An open blocker task on a case.
public class CaseBlockerDto
{
	public Guid Id { get; set; }

	public required string Description { get; set; }
}
