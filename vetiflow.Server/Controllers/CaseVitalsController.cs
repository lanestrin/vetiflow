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

// Record vitals and pain scores on a case (build plan 4.8a), with who and when.
// Recording never changes acuity: that is triage. Any team member until staff
// roles exist. Never log a request: observations and notes are clinical text.
[ApiController]
[Route("api/cases/{id:guid}")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class CaseVitalsController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CaseVitalsController(VetiFlowDbContext dbContext, IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpPost("vitals")]
	public async Task<ActionResult<VitalsRecordDto>> RecordVitals(
		Guid id,
		RecordVitalsRequest request,
		CancellationToken cancellationToken)
	{
		if (!request.HasAnyReading)
		{
			ModelState.AddModelError("Readings", "Record at least one reading or observation.");
			return ValidationProblem();
		}

		var emergencyCase = await _dbContext.EmergencyCases
				.Include(emergencyCase => emergencyCase.Patient)
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		var recorder = await SignedInStaffMemberAsync(cancellationToken);
		var vitals = new VitalsRecord
		{
			HeartRate = request.HeartRate,
			RespiratoryRate = request.RespiratoryRate,
			TemperatureF = request.TemperatureF,
			SpO2 = request.SpO2,
			MucousMembraneColor = request.MucousMembraneColor,
			CapillaryRefillTime = request.CapillaryRefillTime,
			Mentation = request.Mentation,
			RecordedAt = DateTimeOffset.UtcNow,
			RecordedByStaffId = recorder?.Id
		};
		emergencyCase!.RecordVitals(vitals);

		// The new row already carries its Guid id, so on a tracked case EF would
		// take it for an existing row and update nothing. Mark it as new.
		_dbContext.VitalsRecords.Add(vitals);

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		var recorded = new VitalsRecordDto
		{
			Id = vitals.Id,
			HeartRate = vitals.HeartRate,
			RespiratoryRate = vitals.RespiratoryRate,
			TemperatureF = vitals.TemperatureF,
			SpO2 = vitals.SpO2,
			MucousMembraneColor = vitals.MucousMembraneColor,
			CapillaryRefillTime = vitals.CapillaryRefillTime,
			Mentation = vitals.Mentation,
			RecordedAt = vitals.RecordedAt,
			RecordedBy = Reference(recorder)
		};
		recorded.FlagOutOfRange(emergencyCase.Patient.Species);

		return StatusCode(StatusCodes.Status201Created, recorded);
	}

	[HttpPost("pain-scores")]
	public async Task<ActionResult<PainScoreDto>> RecordPainScore(
		Guid id,
		PainScoreRequest request,
		CancellationToken cancellationToken)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id, cancellationToken);
		var refusal = Refuse(emergencyCase);
		if (refusal is not null)
		{
			return refusal;
		}

		var recorder = await SignedInStaffMemberAsync(cancellationToken);
		var painScore = new PainScore
		{
			Score = request.Score!.Value,
			Notes = request.Notes,
			RecordedAt = DateTimeOffset.UtcNow,
			RecordedByStaffId = recorder?.Id
		};
		emergencyCase!.RecordPainScore(painScore);
		_dbContext.PainScores.Add(painScore);

		await _dbContext.SaveChangesAsync(cancellationToken);
		await _caseHub.Clients.All.SendAsync("caseUpdated", id, cancellationToken);

		return StatusCode(StatusCodes.Status201Created, new PainScoreDto
		{
			Id = painScore.Id,
			Score = painScore.Score,
			Notes = painScore.Notes,
			RecordedAt = painScore.RecordedAt,
			RecordedBy = Reference(recorder)
		});
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
	private async Task<StaffMember?> SignedInStaffMemberAsync(CancellationToken cancellationToken)
	{
		var accountId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

		return await _dbContext.Accounts
				.Where(account => account.Id == accountId)
				.Select(account => account.StaffMember)
				.FirstOrDefaultAsync(cancellationToken);
	}
}
