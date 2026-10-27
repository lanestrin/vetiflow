namespace vetiflow.Server.Models;

// Which experience an account signs in to. It comes only from the account
// record, never from the email address or a choice on the sign-in screen.
public enum AccountKind
{
	TeamMember,
	PetParent
}

// A sign-in for the demo (build plan M3a, project plan section 10). It links
// to exactly one person: a team member's StaffMember or a pet parent's Owner.
// The database enforces the link, the email and phone formats and uniqueness.
public class Account
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public AccountKind Kind { get; set; }

	public Guid? StaffMemberId { get; set; }

	public StaffMember? StaffMember { get; set; }

	public Guid? OwnerId { get; set; }

	public Owner? Owner { get; set; }

	// Lower-case. Personal data: never log it or send it to the board or hub.
	public string? Email { get; set; }

	// "+1" and 10 digits. Personal data, like Email.
	public string? PhoneNumber { get; set; }

	// From PasswordHasher; never the password itself, never logged.
	public string? PasswordHash { get; set; }

	public bool IsActive { get; set; } = true;

	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
