using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Board;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// Board-wide numbers for the stat cards (build plan 2.12a) and the page
// heading (2.15a). Team members only, like the board itself: signed out gets
// 401, a pet parent 403.
[ApiController]
[Route("api/board")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class BoardController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly ClinicShifts _clinicShifts;
	private readonly ClinicProfile _clinicProfile;

	public BoardController(VetiFlowDbContext dbContext, ClinicShifts clinicShifts, ClinicProfile clinicProfile)
	{
		_dbContext = dbContext;
		_clinicShifts = clinicShifts;
		_clinicProfile = clinicProfile;
	}

	[HttpGet("summary")]
	public async Task<ActionResult<BoardSummaryDto>> GetSummary(CancellationToken cancellationToken)
	{
		var shift = _clinicShifts.At(DateTimeOffset.UtcNow);
		var activeCases = _dbContext.EmergencyCases.Where(emergencyCase => emergencyCase.DischargedAt == null);
		var awaitingTriage = activeCases.Where(emergencyCase => emergencyCase.Stage == CaseStage.Incoming);
		var critical = activeCases.Where(emergencyCase => emergencyCase.Acuity == AcuityLevel.Critical);
		var previousShift = _clinicShifts.Before(shift);
		// The two shifts' assessed arrivals: few rows, averaged here.
		var assessedArrivals = await _dbContext.EmergencyCases
			.Where(emergencyCase => emergencyCase.VetAssessedAt != null && emergencyCase.ArrivalTime >= previousShift.StartedAt)
			.Select(emergencyCase => new { emergencyCase.ArrivalTime, AssessedAt = emergencyCase.VetAssessedAt!.Value })
			.ToListAsync(cancellationToken);

		return new BoardSummaryDto
		{
			ClinicName = _clinicProfile.Name,
			CliniciansOnFloor = await _dbContext.StaffMembers.OnFloor().CountAsync(cancellationToken),
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
					cancellationToken),
			DoorToDoctor = new DoorToDoctorDto
			{
				CurrentShift = ShiftDoorToDoctor(assessedArrivals
					.Where(arrival => arrival.ArrivalTime >= shift.StartedAt)
					.Select(arrival => arrival.AssessedAt - arrival.ArrivalTime)),
				PreviousShift = ShiftDoorToDoctor(assessedArrivals
					.Where(arrival => arrival.ArrivalTime < shift.StartedAt)
					.Select(arrival => arrival.AssessedAt - arrival.ArrivalTime)),
				Waiting = await activeCases.CountAsync(emergencyCase => emergencyCase.VetAssessedAt == null, cancellationToken)
			}
		};
	}

	private static ShiftDoorToDoctorDto ShiftDoorToDoctor(IEnumerable<TimeSpan> waits)
	{
		var minutes = waits.Select(wait => wait.TotalMinutes).ToList();
		return new ShiftDoorToDoctorDto
		{
			AverageMinutes = minutes.Count == 0 ? null : (int)Math.Round(minutes.Average(), MidpointRounding.AwayFromZero),
			Assessed = minutes.Count
		};
	}
}
