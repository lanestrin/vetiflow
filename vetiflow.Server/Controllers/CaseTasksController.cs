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

// Tasks, blockers and due items on a case (build plan 4.4a): add one, complete
// it and reopen it, with who did it and when. A task is reached only through
// its case. Any team member until staff roles exist. Never log a description:
// it is clinical text.
[ApiController]
[Route("api/cases/{id:guid}/tasks")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class CaseTasksController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CaseTasksController(VetiFlowDbContext dbContext, IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpPost]
	public async Task<ActionResult<CaseTaskCreatedDto>> CreateTask(
		Guid id,
		CaseTaskRequest request,
		CancellationToken cancellationToken)
	{
		var type = request.Type!.Value;
		if (CaseTaskRequest.NeedsDueAt(type) && request.DueAt is null)
		{
			ModelState.AddModelError(nameof(CaseTaskRequest.DueAt), "A reassessment or client update needs a due time.");
		}

		StaffMember? assignee = null;
		if (request.AssignedToStaffId is { } assigneeId)
		{
			assignee = await _dbContext.StaffMembers
					.FirstOrDefaultAsync(staff => staff.Id == assigneeId && staff.IsActive, cancellationToken);
			if (assignee is null)
			{
				ModelState.AddModelError(nameof(CaseTaskRequest.AssignedToStaffId), "No active staff member has this ID.");
			}
		}

		if (!ModelState.IsValid)
		{
			return ValidationProblem();
		}

		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		var creatorId = await SignedInStaffMemberIdAsync(cancellationToken);
		var creator = creatorId is null
				? null
				: await _dbContext.StaffMembers.FirstAsync(staff => staff.Id == creatorId, cancellationToken);
		var now = DateTimeOffset.UtcNow;
		var task = new CaseTask
		{
			EmergencyCaseId = id,
			Type = type,
			Description = request.Description!,
			DueAt = request.DueAt?.ToUniversalTime(),
			AssignedToStaffId = assignee?.Id,
			CreatedByStaffId = creatorId,
			CreatedAt = now
		};
		_dbContext.CaseTasks.Add(task);
		emergencyCase!.LastUpdated = now;

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return StatusCode(StatusCodes.Status201Created, new CaseTaskCreatedDto
		{
			Id = task.Id,
			Type = task.Type,
			Description = task.Description,
			Status = task.Status,
			DueAt = task.DueAt,
			AssignedTo = Reference(assignee),
			CreatedAt = task.CreatedAt,
			CreatedBy = Reference(creator)
		});
	}

	// Done, with who and when. Completing a done task changes nothing, so a
	// double click is harmless.
	[HttpPost("{taskId:guid}/complete")]
	public Task<IActionResult> CompleteTask(Guid id, Guid taskId, CancellationToken cancellationToken) =>
			ResolveAsync(id, taskId, CaseTaskStatus.Done, cancellationToken);

	// Open again; who resolved it and when are cleared.
	[HttpPost("{taskId:guid}/reopen")]
	public Task<IActionResult> ReopenTask(Guid id, Guid taskId, CancellationToken cancellationToken) =>
			ResolveAsync(id, taskId, CaseTaskStatus.Open, cancellationToken);

	private async Task<IActionResult> ResolveAsync(
		Guid id,
		Guid taskId,
		CaseTaskStatus status,
		CancellationToken cancellationToken)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		var task = await _dbContext.CaseTasks
				.FirstOrDefaultAsync(task => task.Id == taskId && task.EmergencyCaseId == id, cancellationToken);
		if (task is null)
		{
			return Problem(statusCode: StatusCodes.Status404NotFound, title: "This case has no task with this ID");
		}

		if (task.Status == CaseTaskStatus.Cancelled)
		{
			return Problem(statusCode: StatusCodes.Status409Conflict, title: "This task has been cancelled");
		}

		if (task.Status == status)
		{
			return NoContent();
		}

		var now = DateTimeOffset.UtcNow;
		task.Status = status;
		if (status == CaseTaskStatus.Done)
		{
			task.ResolvedByStaffId = await SignedInStaffMemberIdAsync(cancellationToken);
			task.ResolvedAt = now;
		}
		else
		{
			task.ResolvedByStaffId = null;
			task.ResolvedAt = null;
		}
		emergencyCase!.LastUpdated = now;

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return NoContent();
	}

	// 404 for no such case, 409 once it is discharged, as triage does.
	private ObjectResult? Refuse(EmergencyCase? emergencyCase)
	{
		if (emergencyCase is null)
		{
			return Problem(statusCode: StatusCodes.Status404NotFound, title: "No case has this ID");
		}

		return emergencyCase.DischargedAt is null
				? null
				: Problem(statusCode: StatusCodes.Status409Conflict, title: "This case has been discharged");
	}

	private static CaseReferenceDto? Reference(StaffMember? staff) =>
			staff is null ? null : new CaseReferenceDto { Id = staff.Id, Name = $"{staff.FirstName} {staff.LastName}" };

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
