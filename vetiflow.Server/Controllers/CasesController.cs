using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Data;
using vetiflow.Server.Hubs;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

[ApiController]
[Route("api/cases")]
public class CasesController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly IHubContext<CaseHub> _caseHub;

	public CasesController(
			VetiFlowDbContext dbContext,
			IHubContext<CaseHub> caseHub)
	{
		_dbContext = dbContext;
		_caseHub = caseHub;
	}

	[HttpGet]
	public async Task<ActionResult<List<EmergencyCaseListItemDto>>> GetCases()
	{
		// Active cases only. Untriaged first (risk unknown, next step is triage),
		// then by acuity, then the longest wait. Acuity is stored as text, so it
		// is ranked here; sorting the column would be alphabetical.
		var cases = await _dbContext.EmergencyCases
				.AsNoTracking()
				.Where(emergencyCase => emergencyCase.DischargedAt == null)
				.OrderBy(emergencyCase =>
					emergencyCase.Acuity == null ? 0
					: emergencyCase.Acuity == AcuityLevel.Critical ? 1
					: emergencyCase.Acuity == AcuityLevel.Urgent ? 2
					: emergencyCase.Acuity == AcuityLevel.High ? 3
					: 4)
				.ThenBy(emergencyCase => emergencyCase.ArrivalTime)
				.Select(emergencyCase => new EmergencyCaseListItemDto
				{
					Id = emergencyCase.Id,
					PatientId = emergencyCase.PatientId,
					PatientName = emergencyCase.Patient.Name,
					Species = emergencyCase.Patient.Species,
					Breed = emergencyCase.Patient.Breed,
					WeightKg = emergencyCase.WeightKg,
					PresentingComplaint = emergencyCase.PresentingComplaint,
					Stage = emergencyCase.Stage,
					Status = emergencyCase.Status,
					Acuity = emergencyCase.Acuity,
					ArrivalTime = emergencyCase.ArrivalTime,
					NextAction = emergencyCase.NextAction,
					AssignedDoctor = emergencyCase.AssignedDoctor == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.AssignedDoctor.Id,
							Name = emergencyCase.AssignedDoctor.FirstName + " " + emergencyCase.AssignedDoctor.LastName
						},
					AssignedTechnician = emergencyCase.AssignedTechnician == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.AssignedTechnician.Id,
							Name = emergencyCase.AssignedTechnician.FirstName + " " + emergencyCase.AssignedTechnician.LastName
						},
					Room = emergencyCase.Room == null
						? null
						: new CaseReferenceDto
						{
							Id = emergencyCase.Room.Id,
							Name = emergencyCase.Room.Name
						},
					Blockers = emergencyCase.Tasks
						.Where(task => task.Type == CaseTaskType.Blocker && task.Status == CaseTaskStatus.Open)
						.OrderBy(task => task.CreatedAt)
						.Select(task => new CaseBlockerDto
						{
							Id = task.Id,
							Description = task.Description
						})
						.ToList(),
					LastUpdated = emergencyCase.LastUpdated
				})
				.ToListAsync();

		return Ok(cases);
	}

	[HttpPatch("{id:guid}/stage")]
	public async Task<IActionResult> UpdateStage(
		Guid id,
		UpdateCaseStageRequest request)
	{
		var emergencyCase = await _dbContext.EmergencyCases
				.FirstOrDefaultAsync(emergencyCase => emergencyCase.Id == id);

		if (emergencyCase is null)
		{
			return NotFound();
		}

		emergencyCase.Stage = request.Stage;
		emergencyCase.LastUpdated = DateTimeOffset.UtcNow;

		await _dbContext.SaveChangesAsync();

		await _caseHub.Clients.All.SendAsync(
				"caseUpdated",
				emergencyCase.Id);

		return NoContent();
	}
}