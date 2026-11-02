namespace vetiflow.Server.Contracts.Cases;

// Designates one open task as the case's Next Care Action, or clears the
// designation when TaskId is null (build plan 4.13a). Staff choose the task; the
// server never chooses one.
public class NextActionRequest
{
	public Guid? TaskId { get; set; }
}
