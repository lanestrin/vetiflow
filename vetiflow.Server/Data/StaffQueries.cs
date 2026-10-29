using vetiflow.Server.Models;

namespace vetiflow.Server.Data;

public static class StaffQueries
{
	// Only veterinarians and technicians have a status (2.21a).
	public static readonly StaffRole[] ClinicianRoles = [StaffRole.Veterinarian, StaffRole.Technician];

	// The clinicians on the floor (decided 2026-10-28): active, a veterinarian
	// or technician, and not Unavailable. The on-floor list and the board
	// summary's count both use this, so they always agree.
	public static IQueryable<StaffMember> OnFloor(this IQueryable<StaffMember> staffMembers) =>
		staffMembers.Where(staff => staff.IsActive
			&& ClinicianRoles.Contains(staff.Role)
			&& staff.Status != StaffStatus.Unavailable);
}
