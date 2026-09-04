namespace vetiflow.Server.Models;

public enum StaffRole
{
	Veterinarian,
	Technician,
	Assistant,
	Receptionist,
	Manager
}

public class StaffMember
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string FirstName { get; set; }

	public required string LastName { get; set; }

	public StaffRole Role { get; set; }

	public bool IsActive { get; set; } = true;
}