using System.ComponentModel.DataAnnotations;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Staff;

// My status (build plan 2.21a), read and set by the signed-in clinician.
public class StaffStatusDto
{
	[Required]
	public StaffStatus? Status { get; set; }
}
