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

public class Room
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string Name { get; set; }

	public RoomType Type { get; set; }

	public bool IsAvailable { get; set; } = true;
}