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

// Short clinical tags on a case (build plan 3.5a): add one and remove one, with
// the limits in CaseTagRules and a timeline entry for each change. A tag is
// reached only through its case. Any team member until staff roles exist. Never
// log a tag's text: it is clinical text.
[ApiController]
[Route("api/cases/{id:guid}/tags")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class CaseTagsController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CaseTagsController(VetiFlowDbContext dbContext, IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpPost]
	public async Task<ActionResult<CaseTagDto>> AddTag(
		Guid id,
		CaseTagRequest request,
		CancellationToken cancellationToken)
	{
		if (!ModelState.IsValid)
		{
			return ValidationProblem();
		}

		var text = request.Text!;
		var tone = request.Tone!.Value;

		// The count and the insert run under a lock on the case row, so two
		// concurrent adds to a case with four tags can't both leave it at six.
		await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

		var emergencyCase = await _dbContext.EmergencyCases
				.FromSqlInterpolated($"SELECT * FROM \"EmergencyCases\" WHERE \"Id\" = {id} FOR UPDATE")
				.FirstOrDefaultAsync(cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		var tagCount = await _dbContext.CaseTags
				.CountAsync(tag => tag.EmergencyCaseId == id, cancellationToken);
		if (tagCount >= CaseTagRules.MaxTagsPerCase)
		{
			return Problem(
					statusCode: StatusCodes.Status409Conflict,
					title: $"This case already has {CaseTagRules.MaxTagsPerCase} tags.");
		}

		// Ignores case, so "O2 support" and "o2 support" are one tag.
		var isDuplicate = await _dbContext.CaseTags
				.AnyAsync(tag => tag.EmergencyCaseId == id && tag.Text.ToLower() == text.ToLower(), cancellationToken);
		if (isDuplicate)
		{
			return Problem(
					statusCode: StatusCodes.Status409Conflict,
					title: "This case already has this tag.");
		}

		var creatorId = await SignedInStaffMemberIdAsync(cancellationToken);
		var creator = creatorId is null
				? null
				: await _dbContext.StaffMembers.FirstAsync(staff => staff.Id == creatorId, cancellationToken);
		var now = DateTimeOffset.UtcNow;
		var tag = new CaseTag
		{
			EmergencyCaseId = id,
			Text = text,
			Tone = tone,
			CreatedAt = now,
			CreatedByStaffId = creatorId
		};
		// Added to the context directly: a Guid-keyed row added through the
		// case's collection on a tracked case would be taken for an existing row.
		_dbContext.CaseTags.Add(tag);
		AddEvent(emergencyCase!, CaseEventType.TagAdded, $"Tag added: {text}", now, creatorId);

		await _dbContext.SaveChangesAsync(cancellationToken);
		await transaction.CommitAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return StatusCode(StatusCodes.Status201Created, new CaseTagDto
		{
			Id = tag.Id,
			Text = tag.Text,
			Tone = tag.Tone,
			CreatedAt = tag.CreatedAt,
			CreatedBy = Reference(creator)
		});
	}

	[HttpDelete("{tagId:guid}")]
	public async Task<IActionResult> RemoveTag(
		Guid id,
		Guid tagId,
		CancellationToken cancellationToken)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		// A tag is reached only through its case: another case's tag is not found here.
		var tag = await _dbContext.CaseTags
				.FirstOrDefaultAsync(tag => tag.Id == tagId && tag.EmergencyCaseId == id, cancellationToken);
		if (tag is null)
		{
			return Problem(statusCode: StatusCodes.Status404NotFound, title: "This case has no tag with this ID");
		}

		var removerId = await SignedInStaffMemberIdAsync(cancellationToken);
		var now = DateTimeOffset.UtcNow;
		_dbContext.CaseTags.Remove(tag);
		// The timeline keeps the removed text, so the record survives the row.
		AddEvent(emergencyCase!, CaseEventType.TagRemoved, $"Tag removed: {tag.Text}", now, removerId);

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return NoContent();
	}

	// 404 for no such case, 409 once it is discharged, as triage and tasks do.
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

	private void AddEvent(
		EmergencyCase emergencyCase,
		CaseEventType type,
		string description,
		DateTimeOffset now,
		Guid? staffMemberId)
	{
		var caseEvent = new CaseEvent
		{
			Type = type,
			Description = description,
			CreatedAt = now,
			CreatedByStaffId = staffMemberId
		};
		emergencyCase.Events.Add(caseEvent);
		emergencyCase.LastUpdated = now;

		// Added to the context directly, for the same reason as the tag.
		_dbContext.CaseEvents.Add(caseEvent);
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
