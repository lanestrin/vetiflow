using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts;

// How a person's name shows in the top bar's profile (2.10a) and the
// clinicians on floor (2.21a).
public static class StaffNames
{
	// "Dr. Jordan Reed" for a veterinarian, otherwise the name.
	public static string DisplayName(string firstName, string lastName, StaffRole? role)
	{
		var name = $"{firstName} {lastName}";
		return role == StaffRole.Veterinarian ? $"Dr. {name}" : name;
	}

	public static string Initials(string firstName, string lastName) =>
		$"{char.ToUpperInvariant(firstName[0])}{char.ToUpperInvariant(lastName[0])}";
}
