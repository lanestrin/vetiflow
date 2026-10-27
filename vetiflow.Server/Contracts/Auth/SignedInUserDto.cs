using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Auth;

// Who is signed in, and which experience the client opens for them.
public class SignedInUserDto
{
	public required string Name { get; set; }

	public AccountKind Experience { get; set; }
}
