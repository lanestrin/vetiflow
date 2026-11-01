using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Staff;

// A veterinarian or technician on the team (build plan 4.5), with their status and
// active cases. Never contact details.
public class TeamClinicianDto
{
	public Guid Id { get; set; }

	// "Dr. Jordan Lee" for a veterinarian, otherwise the name.
	public required string DisplayName { get; set; }

	public required string Initials { get; set; }

	public StaffRole Role { get; set; }

	public StaffStatus Status { get; set; }

	// The same count as the on-floor list (2.21a).
	public int ActiveCaseCount { get; set; }

	// Cases not discharged where they are the assigned doctor or technician; each
	// case once, by case number.
	public required List<TeamCaseDto> ActiveCases { get; set; }
}
