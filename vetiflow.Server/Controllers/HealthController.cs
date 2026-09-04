using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;

namespace vetiflow.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;

	public HealthController(VetiFlowDbContext dbContext)
	{
		_dbContext = dbContext;
	}

	[HttpGet]
	public async Task<IActionResult> Get()
	{
		var canConnect = await _dbContext.Database.CanConnectAsync();

		if (!canConnect)
		{
			return StatusCode(
					StatusCodes.Status503ServiceUnavailable,
					new { status = "unhealthy", database = "disconnected" });
		}

		return Ok(new
		{
			status = "healthy",
			database = "connected"
		});
	}
}