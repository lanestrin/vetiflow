using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.PetParent;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;

namespace vetiflow.Server.Controllers;

// The signed-in pet parent's own pets. The owner always comes from the
// account behind the token, never from the request, so no one can reach
// another owner's pet (owners never reach a patient by ID alone).
[ApiController]
[Route("api/pet-parent")]
[Authorize(Policy = AuthNames.PetParentPolicy)]
public class PetParentController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;

	public PetParentController(VetiFlowDbContext dbContext)
	{
		_dbContext = dbContext;
	}

	[HttpGet("pets")]
	public async Task<ActionResult<List<PetSummaryDto>>> GetPets(CancellationToken cancellationToken)
	{
		if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var accountId))
		{
			return Forbid();
		}

		var ownerId = await _dbContext.Accounts
				.AsNoTracking()
				.Where(account => account.Id == accountId)
				.Select(account => account.OwnerId)
				.SingleOrDefaultAsync(cancellationToken);

		// Behind the policy this shouldn't happen; refuse rather than guess.
		if (ownerId is null)
		{
			return Forbid();
		}

		var pets = await _dbContext.Patients
				.AsNoTracking()
				.Where(patient => patient.OwnerId == ownerId)
				.Select(patient => new PetSummaryDto
				{
					Name = patient.Name,
					Species = patient.Species,
					InCare = _dbContext.EmergencyCases.Any(emergencyCase =>
						emergencyCase.PatientId == patient.Id && emergencyCase.DischargedAt == null)
				})
				.OrderByDescending(pet => pet.InCare)
				.ThenBy(pet => pet.Name)
				.ToListAsync(cancellationToken);

		return pets;
	}
}
