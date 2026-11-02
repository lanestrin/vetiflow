using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Rooms;

// One room for the location dropdown (build plan 4.3a), with the active case in
// it, if any, so staff can see a room is in use before choosing it.
public class RoomDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }

	public RoomType Type { get; set; }

	public RoomCaseDto? OccupiedBy { get; set; }
}
