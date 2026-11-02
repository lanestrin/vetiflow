using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using vetiflow.Server.Contracts;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Hubs;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// A case's attending veterinarian, primary technician and room (build plan
// 4.3a). One endpoint per field, so two people changing different fields never
// undo each other. Each change goes on the timeline with who made it and when,
// which is the assignment history. Any team member until staff roles exist (S.6).
[ApiController]
[Route("api/cases/{id:guid}")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class CaseAssignmentController : ControllerBase
{
	private const string ActiveRoomIndex = "IX_EmergencyCases_RoomId_Active";

	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CaseAssignmentController(VetiFlowDbContext dbContext, IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpPut("veterinarian")]
	public Task<IActionResult> SetVeterinarian(Guid id, AssignmentRequest request, CancellationToken cancellationToken) =>
			SetClinicianAsync(id, request.Id, StaffRole.Veterinarian, cancellationToken);

	[HttpPut("technician")]
	public Task<IActionResult> SetTechnician(Guid id, AssignmentRequest request, CancellationToken cancellationToken) =>
			SetClinicianAsync(id, request.Id, StaffRole.Technician, cancellationToken);

	// A room holds one active case: a room in use returns 409 naming that case,
	// also when another request takes it at the same moment.
	[HttpPut("room")]
	public async Task<IActionResult> SetRoom(Guid id, AssignmentRequest request, CancellationToken cancellationToken)
	{
		Room? room = null;
		if (request.Id is { } roomId)
		{
			room = await _dbContext.Rooms.FirstOrDefaultAsync(candidate => candidate.Id == roomId, cancellationToken);
			if (room is null)
			{
				ModelState.AddModelError(nameof(AssignmentRequest.Id), "No room has this ID.");
				return ValidationProblem();
			}
		}

		var emergencyCase = await _dbContext.EmergencyCases
				.Include(emergencyCase => emergencyCase.Room)
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		if (emergencyCase!.RoomId == room?.Id)
		{
			return NoContent();
		}

		if (room is not null && await FindCaseInRoomAsync(room.Id, id, cancellationToken) is { } occupant)
		{
			return RoomInUse(occupant);
		}

		var now = DateTimeOffset.UtcNow;
		var description = (emergencyCase.Room, room) switch
		{
			(_, null) => "Room cleared",
			(null, _) => $"Room: {room.Name}",
			_ => $"Room: {emergencyCase.Room.Name} → {room.Name}"
		};
		emergencyCase.Room = room;
		emergencyCase.RoomId = room?.Id;
		emergencyCase.LastUpdated = now;
		CaseTimeline.Add(_dbContext, emergencyCase, CaseEventType.RoomChanged, description, now,
				await SignedInStaffMemberIdAsync(cancellationToken));

		try
		{
			await _dbContext.SaveChangesAsync(cancellationToken);
		}
		catch (DbUpdateException exception)
			when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: ActiveRoomIndex })
		{
			// Another case took the room between the check and the save.
			var winner = await FindCaseInRoomAsync(room!.Id, id, cancellationToken);
			return RoomInUse(winner);
		}

		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return NoContent();
	}

	private async Task<IActionResult> SetClinicianAsync(
		Guid id,
		Guid? staffId,
		StaffRole role,
		CancellationToken cancellationToken)
	{
		var roleName = role == StaffRole.Veterinarian ? "Attending veterinarian" : "Technician";
		StaffMember? clinician = null;
		if (staffId is not null)
		{
			clinician = await _dbContext.StaffMembers
					.FirstOrDefaultAsync(staff => staff.Id == staffId && staff.IsActive && staff.Role == role, cancellationToken);
			if (clinician is null)
			{
				ModelState.AddModelError(nameof(AssignmentRequest.Id), $"No active {role.ToString().ToLowerInvariant()} has this ID.");
				return ValidationProblem();
			}
		}

		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		var current = role == StaffRole.Veterinarian ? emergencyCase!.AssignedDoctorId : emergencyCase!.AssignedTechnicianId;
		if (current == clinician?.Id)
		{
			return NoContent();
		}

		if (role == StaffRole.Veterinarian)
		{
			emergencyCase.AssignedDoctorId = clinician?.Id;
		}
		else
		{
			emergencyCase.AssignedTechnicianId = clinician?.Id;
		}

		var now = DateTimeOffset.UtcNow;
		emergencyCase.LastUpdated = now;
		var description = clinician is null
				? $"{roleName} removed"
				: $"{roleName}: {StaffNames.DisplayName(clinician.FirstName, clinician.LastName, clinician.Role)}";
		CaseTimeline.Add(_dbContext, emergencyCase, CaseEventType.Assigned, description, now,
				await SignedInStaffMemberIdAsync(cancellationToken));

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return NoContent();
	}

	// 404 for no such case, 409 once it is discharged, as tasks do.
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

	private async Task<(Guid Id, int Number)?> FindCaseInRoomAsync(Guid roomId, Guid exceptCaseId, CancellationToken cancellationToken)
	{
		var occupant = await _dbContext.EmergencyCases
				.AsNoTracking()
				.Where(emergencyCase => emergencyCase.RoomId == roomId
					&& emergencyCase.DischargedAt == null
					&& emergencyCase.Id != exceptCaseId)
				.Select(emergencyCase => new { emergencyCase.Id, emergencyCase.CaseNumber })
				.FirstOrDefaultAsync(cancellationToken);

		return occupant is null ? null : (occupant.Id, occupant.CaseNumber);
	}

	// Names only the case's ID and number: no patient or owner details.
	private ObjectResult RoomInUse((Guid Id, int Number)? occupant)
	{
		var result = Problem(
				statusCode: StatusCodes.Status409Conflict,
				title: "This room is in use");
		var problem = (ProblemDetails)result.Value!;
		problem.Extensions["occupyingCaseId"] = occupant?.Id;
		problem.Extensions["occupyingCaseNumber"] = occupant is null ? null : $"ER-{occupant.Value.Number}";
		return result;
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
