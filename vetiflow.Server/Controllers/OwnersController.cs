using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts;
using vetiflow.Server.Contracts.Owners;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// Owner records for hospital team members (build plan 4.6a). They carry
// contact details, so pet parents never reach them.
[ApiController]
[Route("api/owners")]
[Authorize(Policy = AuthNames.TeamMemberPolicy)]
public class OwnersController : ControllerBase
{
	private readonly VetiFlowDbContext _dbContext;

	public OwnersController(VetiFlowDbContext dbContext)
	{
		_dbContext = dbContext;
	}

	// Owners whose first, last or full name contains the text.
	[HttpGet]
	public async Task<ActionResult<List<OwnerDto>>> SearchOwners(string? search, CancellationToken cancellationToken)
	{
		if (!SearchText.TryClean(search, out var text))
		{
			ModelState.AddModelError("search", SearchText.ErrorMessage);
			return ValidationProblem();
		}

		var pattern = SearchText.ContainsPattern(text);

		var owners = await _dbContext.Owners
				.AsNoTracking()
				.Where(owner =>
					EF.Functions.ILike(owner.FirstName, pattern, SearchText.EscapeCharacter)
					|| EF.Functions.ILike(owner.LastName, pattern, SearchText.EscapeCharacter)
					|| EF.Functions.ILike(owner.FirstName + " " + owner.LastName, pattern, SearchText.EscapeCharacter))
				.OrderBy(owner => owner.LastName)
				.ThenBy(owner => owner.FirstName)
				.Take(SearchText.MaxResults)
				.Select(owner => OwnerDto.From(owner))
				.ToListAsync(cancellationToken);

		return owners;
	}

	[HttpGet("{id:guid}")]
	public async Task<ActionResult<OwnerDto>> GetOwner(Guid id, CancellationToken cancellationToken)
	{
		var owner = await _dbContext.Owners
				.AsNoTracking()
				.FirstOrDefaultAsync(owner => owner.Id == id, cancellationToken);

		if (owner is null)
		{
			return NotFound();
		}

		return OwnerDto.From(owner);
	}

	[HttpPost]
	public async Task<ActionResult<OwnerDto>> CreateOwner(SaveOwnerRequest request, CancellationToken cancellationToken)
	{
		var owner = new Owner
		{
			FirstName = request.FirstName!,
			LastName = request.LastName!,
			Phone = request.Phone,
			Email = request.Email
		};

		_dbContext.Owners.Add(owner);
		await _dbContext.SaveChangesAsync(cancellationToken);

		return CreatedAtAction(nameof(GetOwner), new { id = owner.Id }, OwnerDto.From(owner));
	}

	[HttpPut("{id:guid}")]
	public async Task<ActionResult<OwnerDto>> UpdateOwner(Guid id, SaveOwnerRequest request, CancellationToken cancellationToken)
	{
		var owner = await _dbContext.Owners
				.FirstOrDefaultAsync(owner => owner.Id == id, cancellationToken);

		if (owner is null)
		{
			return NotFound();
		}

		owner.FirstName = request.FirstName!;
		owner.LastName = request.LastName!;
		owner.Phone = request.Phone;
		owner.Email = request.Email;

		await _dbContext.SaveChangesAsync(cancellationToken);

		return OwnerDto.From(owner);
	}
}
