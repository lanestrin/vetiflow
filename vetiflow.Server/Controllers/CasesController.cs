using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Data;
using vetiflow.Server.Hubs;

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
		var cases = await _dbContext.EmergencyCases
				.AsNoTracking()
				.OrderByDescending(emergencyCase => emergencyCase.ArrivalTime)
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
					NextAction = emergencyCase.NextAction
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