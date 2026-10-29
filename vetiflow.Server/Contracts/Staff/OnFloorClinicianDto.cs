using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Staff;

// A clinician on the floor (build plan 2.21a): not Unavailable. Never contact
// details.
public class OnFloorClinicianDto
{
	public Guid Id { get; set; }

	// "Dr. Jordan Lee" for a veterinarian, otherwise the name.
	public required string DisplayName { get; set; }

	public required string Initials { get; set; }

	public StaffRole Role { get; set; }

	public StaffStatus Status { get; set; }

	// Cases not discharged where they are the assigned doctor or technician.
	public int ActiveCaseCount { get; set; }
}
