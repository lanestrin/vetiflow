namespace vetiflow.Server.Models;

public enum RoomType
{
	Exam,
	Treatment,
	ICU,
	Oxygen,
	Isolation,
	Surgery,
	Imaging
}

// Availability is derived from active cases (EmergencyCase.RoomId),
// so it is not stored here and cannot drift from the board.
public class Room
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string Name { get; set; }

	public RoomType Type { get; set; }
}
