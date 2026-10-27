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

	public static Owner Owner() => new()
	{
		FirstName = "Owner",
		LastName = Unique(),
		Phone = "555-0100",
		Email = "owner@example.com"
	};

	public static Room Room() => new()
	{
		Name = $"Room {Unique()}",
		Type = RoomType.Exam
	};

	public static StaffMember StaffMember(StaffRole role) => new()
	{
		FirstName = "Staff",
		LastName = Unique(),
		Role = role
	};

	// Valid accounts with unique contact details; tests change one field to
	// break a rule.
	public static Account TeamMemberAccount(StaffMember staffMember) => new()
	{
		Kind = AccountKind.TeamMember,
		StaffMember = staffMember,
		Email = $"team.{Unique()}@example.com",
		PhoneNumber = UniquePhone()
	};

	public static Account PetParentAccount(Owner owner) => new()
	{
		Kind = AccountKind.PetParent,
		Owner = owner,
		Email = $"parent.{Unique()}@example.com",
		PhoneNumber = UniquePhone()
	};

	public static CaseTask Task(
		CaseTaskType type = CaseTaskType.Task,
		CaseTaskStatus status = CaseTaskStatus.Open) => new()
	{
		Type = type,
		Status = status,
		Description = $"{type} {Unique()}"
	};

	public static EmergencyCase Case(Patient patient, Room? room = null) => new()
	{
		Patient = patient,
		Room = room,
		PresentingComplaint = "Vomiting"
	};

	private static string Unique() => Guid.NewGuid().ToString("N")[..8];

	private static string UniquePhone() => "+1" + Random.Shared.NextInt64(1_000_000_000, 10_000_000_000);
}
