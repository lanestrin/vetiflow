using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;

namespace vetiflow.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;
	private readonly ILogger<HealthController> _logger;

	public HealthController(
		VetiFlowDbContext dbContext,
		ILogger<HealthController> logger)
	{
		_dbContext = dbContext;
		_logger = logger;
	}

	[HttpGet]
	public async Task<IActionResult> Get()
	{
		try
		{
			await _dbContext.Database.ExecuteSqlRawAsync("SELECT 1");

			return Ok(new
			{
				status = "healthy",
				database = "connected"
			});
		}
		catch (Exception exception)
		{
			_logger.LogError(
				exception,
				"Database health check failed.");

			return StatusCode(
				StatusCodes.Status503ServiceUnavailable,
				new
				{
					status = "unhealthy",
					database = "disconnected"
				});
		}
	}
}