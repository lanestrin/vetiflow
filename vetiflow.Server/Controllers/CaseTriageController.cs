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

// Complete triage and re-triage (build plan 4.2a). Completing triage confirms
// or changes intake's provisional priority and moves the case out of Incoming;
// later calls re-triage and leave the stage alone. Any team member until staff
// roles exist, then clinicians only. Never log the request: notes are clinical.
[ApiController]
[Route("api/cases/{id:guid}/triage")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class CaseTriageController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CaseTriageController(VetiFlowDbContext dbContext, IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpPost]
	public async Task<IActionResult> RecordTriage(
		Guid id,
		TriageRequest request,
		CancellationToken cancellationToken)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);

		if (emergencyCase is null)
		{
			return NotFound();
		}

		if (emergencyCase.DischargedAt is not null)
		{
			return Problem(
					statusCode: StatusCodes.Status409Conflict,
					title: "This case has been discharged");
		}

		var priority = request.Priority!.Value;
		var completesTriage = emergencyCase.Stage == CaseStage.Incoming;
		var description = completesTriage || emergencyCase.Acuity is null
				? $"Triage completed · {priority}"
				: emergencyCase.Acuity == priority
					? $"Re-triaged · {priority} confirmed"
					: $"Re-triaged · {emergencyCase.Acuity} → {priority}";
		var staffMemberId = await SignedInStaffMemberIdAsync(cancellationToken);
		var now = DateTimeOffset.UtcNow;

		var assessment = new TriageAssessment
		{
			Acuity = priority,
			RawIntakeNotes = request.Notes,
			AssessedAt = now,
			AssessedByStaffId = staffMemberId
		};
		emergencyCase.RecordTriage(assessment);

		if (completesTriage)
		{
			emergencyCase.MoveToStage(CaseStage.Triage);
		}

		var triaged = new CaseEvent
		{
			Type = CaseEventType.Triaged,
			Description = description,
			CreatedAt = now,
			CreatedByStaffId = staffMemberId
		};
		emergencyCase.Events.Add(triaged);

		// The new rows already carry their Guid ids, so on a tracked case EF would
		// take them for existing rows and update nothing. Mark them as new.
		_dbContext.TriageAssessments.Add(assessment);
		_dbContext.CaseEvents.Add(triaged);

		await _dbContext.SaveChangesAsync(cancellationToken);

		await _caseHub.Clients.All.SendAsync("caseUpdated", emergencyCase.Id, cancellationToken);

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
