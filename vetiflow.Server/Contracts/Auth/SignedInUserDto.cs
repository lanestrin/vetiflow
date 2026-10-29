using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Auth;

// Who is signed in, which experience the client opens for them, and what the
// top bar's profile shows (build plan 2.10a). Never contact details.
public class SignedInUserDto
{
	public required string Name { get; set; }

	public AccountKind Experience { get; set; }

	// "Dr. Jordan Reed" for a veterinarian, otherwise the name.
	public required string DisplayName { get; set; }

	public required string Initials { get; set; }

	// The staff role; null for a pet parent.
	public StaffRole? Role { get; set; }

	// The account must be loaded with its StaffMember or Owner.
	public static SignedInUserDto From(Account account)
	{
		var (firstName, lastName) = account.Kind == AccountKind.TeamMember
			? (account.StaffMember!.FirstName, account.StaffMember.LastName)
			: (account.Owner!.FirstName, account.Owner.LastName);
		var role = account.StaffMember?.Role;

		return new SignedInUserDto
		{
			Name = $"{firstName} {lastName}",
			Experience = account.Kind,
			DisplayName = StaffNames.DisplayName(firstName, lastName, role),
			Initials = StaffNames.Initials(firstName, lastName),
			Role = role
		};
	}
}
