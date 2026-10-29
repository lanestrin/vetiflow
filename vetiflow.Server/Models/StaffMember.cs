namespace vetiflow.Server.Models;

public enum StaffRole
{
	Veterinarian,
	Technician,
	Assistant,
	Receptionist,
	Manager
}

// My status (build plan 2.21a), set by each veterinarian or technician.
// Anyone not Unavailable is on the floor.
public enum StaffStatus
{
	Available,
	Busy,
	AtLimit,
	Unavailable
}

public class StaffMember
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string FirstName { get; set; }

	public required string LastName { get; set; }

	public StaffRole Role { get; set; }

	public bool IsActive { get; set; } = true;

	// Nobody counts as on the floor until they say so.
	public StaffStatus Status { get; set; } = StaffStatus.Unavailable;
}