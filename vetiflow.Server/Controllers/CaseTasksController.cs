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
			CreatedAt = now,
			Priority = request.Priority
		};
		_dbContext.CaseTasks.Add(task);
		emergencyCase!.LastUpdated = now;
		if (task.Priority is { } priority)
		{
			CaseTimeline.Add(_dbContext, emergencyCase, CaseEventType.TaskPriorityChanged,
					PriorityDescription(priority), now, creatorId);
		}

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
			CreatedBy = Reference(creator),
			Priority = task.Priority
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

	// Staff designate one open task as the case's Next Care Action, or clear the
	// designation (build plan 4.13a). Designating a task replaces an earlier one on
	// the case. Clearing never promotes another task.
	[HttpPut("/api/cases/{id:guid}/next-action")]
	public async Task<IActionResult> SetNextAction(
		Guid id,
		NextActionRequest request,
		CancellationToken cancellationToken)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		var now = DateTimeOffset.UtcNow;
		var staffId = await SignedInStaffMemberIdAsync(cancellationToken);
		var designated = await _dbContext.CaseTasks
				.Where(task => task.EmergencyCaseId == id && task.IsNextAction)
				.ToListAsync(cancellationToken);

		if (request.TaskId is not { } taskId)
		{
			if (designated.Count == 0)
			{
				return NoContent();
			}

			foreach (var previous in designated)
			{
				ClearDesignation(previous, emergencyCase!, now, "Next care action cleared", staffId);
			}
			await SaveAndNotifyAsync(id, cancellationToken);
			return NoContent();
		}

		var task = await _dbContext.CaseTasks
				.FirstOrDefaultAsync(task => task.Id == taskId && task.EmergencyCaseId == id, cancellationToken);
		if (task is null)
		{
			return Problem(statusCode: StatusCodes.Status404NotFound, title: "This case has no task with this ID");
		}

		if (task.Status != CaseTaskStatus.Open)
		{
			return Problem(statusCode: StatusCodes.Status409Conflict, title: "Only an open task can be the next care action.");
		}

		if (task.IsNextAction)
		{
			return NoContent();
		}

		// Clear the earlier designation and save it first, so the one-per-case index
		// never sees two designated rows; the change is one transaction.
		await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
		foreach (var previous in designated)
		{
			ClearDesignation(previous, emergencyCase!, now, "Next care action cleared: replaced", staffId);
		}
		if (designated.Count > 0)
		{
			await _dbContext.SaveChangesAsync(cancellationToken);
		}

		task.IsNextAction = true;
		task.NextActionDesignatedAt = now;
		task.NextActionDesignatedByStaffId = staffId;
		emergencyCase!.LastUpdated = now;
		CaseTimeline.Add(_dbContext, emergencyCase, CaseEventType.NextActionDesignated,
				"Next care action designated", now, staffId);

		await _dbContext.SaveChangesAsync(cancellationToken);
		await transaction.CommitAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return NoContent();
	}

	// Clears a task's designation and records it on the timeline, as part of the
	// change that caused it (build plan 4.13a).
	private void ClearDesignation(
		CaseTask task,
		EmergencyCase emergencyCase,
		DateTimeOffset now,
		string description,
		Guid? staffId)
	{
		task.IsNextAction = false;
		task.NextActionDesignatedAt = null;
		task.NextActionDesignatedByStaffId = null;
		emergencyCase.LastUpdated = now;
		CaseTimeline.Add(_dbContext, emergencyCase, CaseEventType.NextActionCleared, description, now, staffId);
	}

	private async Task SaveAndNotifyAsync(Guid id, CancellationToken cancellationToken)
	{
		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);
	}

	// Staff set or clear a task's priority (build plan 4.13a). Nothing else changes
	// with it: no ranking, no designation. Each real change is on the timeline.
	[HttpPost("{taskId:guid}/priority")]
	public async Task<IActionResult> SetPriority(
		Guid id,
		Guid taskId,
		TaskPriorityRequest request,
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

		if (task.Status != CaseTaskStatus.Open)
		{
			return Problem(statusCode: StatusCodes.Status409Conflict, title: "This task is closed; its priority can no longer change.");
		}

		if (task.Priority == request.Priority)
		{
			return NoContent();
		}

		var now = DateTimeOffset.UtcNow;
		task.Priority = request.Priority;
		emergencyCase!.LastUpdated = now;
		CaseTimeline.Add(_dbContext, emergencyCase, CaseEventType.TaskPriorityChanged,
				PriorityDescription(request.Priority), now, await SignedInStaffMemberIdAsync(cancellationToken));

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return NoContent();
	}

	// Timeline wording for a priority change. It never repeats the task text.
	private static string PriorityDescription(TaskPriority? priority) =>
			priority is null ? "Priority cleared" : $"Priority set to {priority}";

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

		// A completed task is no longer the Next Care Action. Clearing it here, in the
		// same save, means staff are never blocked by a designation (build plan 4.13a).
		if (status == CaseTaskStatus.Done && task.IsNextAction)
		{
			ClearDesignation(task, emergencyCase!, now, "Next care action cleared: task completed",
					await SignedInStaffMemberIdAsync(cancellationToken));
		}

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
