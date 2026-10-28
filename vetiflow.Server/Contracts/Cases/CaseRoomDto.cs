using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// Where a case is: the room and its area ("Oxygen Cage", oxygen).
public class CaseRoomDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }

	public RoomType Type { get; set; }
}
