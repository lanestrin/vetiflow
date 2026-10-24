using vetiflow.Server.Models;

namespace vetiflow.Server.Tests.Infrastructure;

// Builders for valid entities. Names are unique so rows created by one test
// are easy to tell apart from seed data and from other tests' rows.
public static class TestData
{
	public static Patient Patient() => new()
	{
		Name = $"Patient {Unique()}",
		Species = "Dog",
		Breed = "Mixed"
	};

	public static Room Room() => new()
	{
		Name = $"Room {Unique()}",
		Type = RoomType.Exam
	};

	public static EmergencyCase Case(Patient patient, Room? room = null) => new()
	{
		Patient = patient,
		Room = room,
		PresentingComplaint = "Vomiting"
	};

	private static string Unique() => Guid.NewGuid().ToString("N")[..8];
}
