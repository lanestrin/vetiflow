namespace vetiflow.Server.Contracts.Cases;

// Sets a case's attending veterinarian, primary technician or room (build plan
// 4.3a); a null Id clears it ("Not assigned", or no room).
public class AssignmentRequest
{
	public Guid? Id { get; set; }
}
