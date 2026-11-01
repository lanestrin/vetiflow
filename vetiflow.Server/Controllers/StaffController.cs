using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts;
using vetiflow.Server.Contracts.Staff;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// My status and the clinicians on floor (build plan 2.21a). Team members only:
// signed out gets 401, a pet parent 403. Only veterinarians and technicians
// have a status, and each sets only their own; no route takes a staff ID.
[ApiController]
[Route("api/staff")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class StaffController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;

	public StaffController(VetiFlowDbContext dbContext)
	{
		_dbContext = dbContext;
	}

	[HttpGet("me/status")]
	public async Task<ActionResult<StaffStatusDto>> GetMyStatus(CancellationToken cancellationToken)
	{
		var clinician = await SignedInClinicianAsync(cancellationToken);
		if (clinician is null)
		{
			return NotAClinician();
		}

		return new StaffStatusDto { Status = clinician.Status };
	}

	[HttpPut("me/status")]
	public async Task<IActionResult> SetMyStatus(StaffStatusDto request, CancellationToken cancellationToken)
	{
		var clinician = await SignedInClinicianAsync(cancellationToken);
		if (clinician is null)
		{
			return NotAClinician();
		}

		clinician.Status = request.Status!.Value;
		await _dbContext.SaveChangesAsync(cancellationToken);

		return NoContent();
	}

	[HttpGet("on-floor")]
	public async Task<ActionResult<List<OnFloorClinicianDto>>> GetOnFloor(CancellationToken cancellationToken)
	{
		var clinicians = await _dbContext.StaffMembers
				.AsNoTracking()
				.OnFloor()
				.OrderBy(staff => staff.LastName)
				.ThenBy(staff => staff.FirstName)
				.Select(staff => new
				{
					staff.Id,
					staff.FirstName,
					staff.LastName,
					staff.Role,
					staff.Status,
					ActiveCaseCount = _dbContext.EmergencyCases.Count(emergencyCase =>
						emergencyCase.DischargedAt == null
						&& (emergencyCase.AssignedDoctorId == staff.Id || emergencyCase.AssignedTechnicianId == staff.Id))
				})
				.ToListAsync(cancellationToken);

		return clinicians
				.Select(staff => new OnFloorClinicianDto
				{
					Id = staff.Id,
					DisplayName = StaffNames.DisplayName(staff.FirstName, staff.LastName, staff.Role),
					Initials = StaffNames.Initials(staff.FirstName, staff.LastName),
					Role = staff.Role,
					Status = staff.Status,
					ActiveCaseCount = staff.ActiveCaseCount
				})
				.ToList();
	}

	// Every active veterinarian and technician (build plan 4.5): the clinicians on
	// the floor first, then the Unavailable ones, each by name. Each has the same
	// active-case rule as the on-floor list (2.21a).
	[HttpGet("team")]
	public async Task<ActionResult<List<TeamClinicianDto>>> GetTeam(CancellationToken cancellationToken)
	{
		var clinicians = await _dbContext.StaffMembers
				.AsNoTracking()
				.Where(staff => staff.IsActive && StaffQueries.ClinicianRoles.Contains(staff.Role))
				.OrderBy(staff => staff.LastName)
				.ThenBy(staff => staff.FirstName)
				.Select(staff => new
				{
					staff.Id,
					staff.FirstName,
					staff.LastName,
					staff.Role,
					staff.Status,
					ActiveCases = _dbContext.EmergencyCases
						.Where(emergencyCase => emergencyCase.DischargedAt == null
							&& (emergencyCase.AssignedDoctorId == staff.Id || emergencyCase.AssignedTechnicianId == staff.Id))
						.OrderBy(emergencyCase => emergencyCase.CaseNumber)
						.Select(emergencyCase => new TeamCaseDto
						{
							Id = emergencyCase.Id,
							CaseNumber = "ER-" + emergencyCase.CaseNumber,
							PatientName = emergencyCase.Patient.Name
						})
						.ToList()
				})
				.ToListAsync(cancellationToken);

		return clinicians
				.OrderBy(staff => staff.Status == StaffStatus.Unavailable)
				.Select(staff => new TeamClinicianDto
				{
					Id = staff.Id,
					DisplayName = StaffNames.DisplayName(staff.FirstName, staff.LastName, staff.Role),
					Initials = StaffNames.Initials(staff.FirstName, staff.LastName),
					Role = staff.Role,
					Status = staff.Status,
					ActiveCaseCount = staff.ActiveCases.Count,
					ActiveCases = staff.ActiveCases
				})
				.ToList();
	}

	// The signed-in team member's staff record, tracked so a status can be set,
	// when they are a veterinarian or technician.
	private async Task<StaffMember?> SignedInClinicianAsync(CancellationToken cancellationToken)
	{
		var accountId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

		return await _dbContext.Accounts
				.Where(account => account.Id == accountId)
				.Select(account => account.StaffMember)
				.Where(staff => staff != null && StaffQueries.ClinicianRoles.Contains(staff.Role))
				.FirstOrDefaultAsync(cancellationToken);
	}

	private ObjectResult NotAClinician() =>
			Problem(
					statusCode: StatusCodes.Status403Forbidden,
					title: "Only veterinarians and technicians have a status");
}
