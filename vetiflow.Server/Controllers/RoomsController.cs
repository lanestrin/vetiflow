using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Rooms;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;

namespace vetiflow.Server.Controllers;

// The rooms a case can be moved to (build plan 4.3a). Team members only: signed
// out gets 401, a pet parent 403.
[ApiController]
[Route("api/rooms")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class RoomsController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;

	public RoomsController(VetiFlowDbContext dbContext)
	{
		_dbContext = dbContext;
	}

	// Every room by name. A room is in use while an active (not discharged) case
	// is in it, the same rule as the one-active-case-per-room index.
	[HttpGet]
	public async Task<ActionResult<List<RoomDto>>> GetRooms(CancellationToken cancellationToken)
	{
		return await _dbContext.Rooms
				.AsNoTracking()
				.OrderBy(room => room.Name)
				.Select(room => new RoomDto
				{
					Id = room.Id,
					Name = room.Name,
					Type = room.Type,
					OccupiedBy = _dbContext.EmergencyCases
						.Where(emergencyCase => emergencyCase.RoomId == room.Id && emergencyCase.DischargedAt == null)
						.Select(emergencyCase => new RoomCaseDto
						{
							Id = emergencyCase.Id,
							CaseNumber = "ER-" + emergencyCase.CaseNumber
						})
						.FirstOrDefault()
				})
				.ToListAsync(cancellationToken);
	}
}
