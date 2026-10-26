namespace vetiflow.Server.Models;

// Contact details are personal data: never log them, return them from the
// board list or send them in hub messages.
public class Owner
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string FirstName { get; set; }

	public required string LastName { get; set; }

	public string? Phone { get; set; }

	public string? Email { get; set; }
}
