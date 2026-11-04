using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Hubs;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// Record that a veterinarian assessed the patient and when (build plan 2.16a).
// It ends the door-to-doctor wait. One initial assessment per case; the
// assessor is the signed-in staff member. Any team member in the demo (Demo
// only, no security work).
[ApiController]
[Route("api/cases/{id:guid}/vet-assessment")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class VetAssessmentController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public VetAssessmentController(VetiFlowDbContext dbContext, IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpPost]
	public async Task<IActionResult> Record(Guid id, VetAssessmentRequest request, CancellationToken cancellationToken)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		if (emergencyCase is null)
		{
			return Problem(statusCode: StatusCodes.Status404NotFound, title: "No case has this ID");
		}

		if (emergencyCase.DischargedAt is not null)
		{
			return Problem(statusCode: StatusCodes.Status409Conflict, title: "This case has been discharged");
		}

		if (emergencyCase.VetAssessedAt is not null)
		{
			return Problem(statusCode: StatusCodes.Status409Conflict, title: "The vet assessment is already recorded");
		}

		var now = DateTimeOffset.UtcNow;
		if (!AssessmentEventTime.TryParse(request.OccurredAt, now, out var occurredAt))
		{
			ModelState.AddModelError(nameof(request.OccurredAt), "Use a valid timestamp with an explicit timezone offset that is not in the future.");
			return ValidationProblem();
		}

		var assessedAt = occurredAt ?? now;
		if (assessedAt < emergencyCase.ArrivalTime)
		{
			ModelState.AddModelError(nameof(request.OccurredAt), "The assessment cannot be earlier than the patient's arrival.");
			return ValidationProblem();
		}

		var staffMemberId = await SignedInStaffMemberIdAsync(cancellationToken);
		if (staffMemberId is null)
		{
			return Problem(statusCode: StatusCodes.Status403Forbidden, title: "This account has no staff record");
		}

		emergencyCase.RecordVetAssessment(assessedAt, now, staffMemberId.Value);
		emergencyCase.LastUpdated = now;
		CaseTimeline.Add(_dbContext, emergencyCase, CaseEventType.VetAssessed, "Seen by veterinarian", now, staffMemberId);

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return NoContent();
	}

	// The team member's staff record, from the signed-in account.
	private async Task<Guid?> SignedInStaffMemberIdAsync(CancellationToken cancellationToken)
	{
		var accountId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

		return await _dbContext.Accounts
				.Where(account => account.Id == accountId)
				.Select(account => account.StaffMemberId)
				.FirstOrDefaultAsync(cancellationToken);
	}
}
