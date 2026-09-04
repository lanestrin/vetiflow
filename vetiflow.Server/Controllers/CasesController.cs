using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Cases;
using vetiflow.Server.Data;

namespace vetiflow.Server.Controllers;

[ApiController]
[Route("api/cases")]
public class CasesController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;

	public CasesController(VetiFlowDbContext dbContext)
	{
		_dbContext = dbContext;
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
}