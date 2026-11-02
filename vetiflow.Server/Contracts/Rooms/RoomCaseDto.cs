namespace vetiflow.Server.Contracts.Rooms;

// The active case in a room: enough to name it, nothing more.
public class RoomCaseDto
{
	public Guid Id { get; set; }

	// "ER-2481".
	public required string CaseNumber { get; set; }
}
