using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Owners;

// An owner with contact details: for hospital team members only, never for
// the board list, hub messages or logs.
public class OwnerDto
{
	public Guid Id { get; set; }

	public required string FirstName { get; set; }

	public required string LastName { get; set; }

	public string? Phone { get; set; }

	public string? Email { get; set; }

	public static OwnerDto From(Owner owner) => new()
	{
		Id = owner.Id,
		FirstName = owner.FirstName,
		LastName = owner.LastName,
		Phone = owner.Phone,
		Email = owner.Email
	};
}
