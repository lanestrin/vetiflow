using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Board;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// Board-wide numbers for the stat cards (build plan 2.12a). Team members only,
// like the board itself: signed out gets 401, a pet parent 403.
[ApiController]
[Route("api/board")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class BoardController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly ClinicShifts _clinicShifts;

	public BoardController(VetiFlowDbContext dbContext, ClinicShifts clinicShifts)
	{
		_dbContext = dbContext;
		_clinicShifts = clinicShifts;
	}

	[HttpGet("summary")]
	public async Task<ActionResult<BoardSummaryDto>> GetSummary(CancellationToken cancellationToken)
	{
		var shift = _clinicShifts.At(DateTimeOffset.UtcNow);
		var activeCases = _dbContext.EmergencyCases.Where(emergencyCase => emergencyCase.DischargedAt == null);
		var awaitingTriage = activeCases.Where(emergencyCase => emergencyCase.Stage == CaseStage.Incoming);
		var critical = activeCases.Where(emergencyCase => emergencyCase.Acuity == AcuityLevel.Critical);

		return new BoardSummaryDto
		{
			PatientsInCare = await activeCases.CountAsync(cancellationToken),
			Shift = new ShiftDto { Name = shift.Name, StartedAt = shift.StartedAt },
			ArrivedThisShift = await activeCases
				.CountAsync(emergencyCase => emergencyCase.ArrivalTime >= shift.StartedAt, cancellationToken),
			AwaitingTriage = await awaitingTriage.CountAsync(cancellationToken),
			OldestAwaitingTriageArrivedAt = await awaitingTriage
				.MinAsync(emergencyCase => (DateTimeOffset?)emergencyCase.ArrivalTime, cancellationToken),
			CriticalPatients = await critical.CountAsync(cancellationToken),
			CriticalWithoutCareTeam = await critical
				.CountAsync(
					emergencyCase => emergencyCase.AssignedDoctorId == null && emergencyCase.AssignedTechnicianId == null,
					cancellationToken)
		};
	}
}
