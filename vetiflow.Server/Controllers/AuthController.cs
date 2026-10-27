using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Contracts.Auth;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Models;

namespace vetiflow.Server.Controllers;

// Demo sign-in (build plan M3a, project plan section 10). Never log the
// request: it holds an email and a password.
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
	private static readonly PasswordHasher<Account> PasswordHasher = new();

	private readonly VetiFlowDbContext _dbContext;

	public AuthController(VetiFlowDbContext dbContext)
	{
		_dbContext = dbContext;
	}

	[HttpPost("email")]
	[AllowAnonymous]
	public async Task<IActionResult> SignInByEmail(
		EmailSignInRequest request,
		CancellationToken cancellationToken)
	{
		var email = request.Email.Trim().ToLowerInvariant();

		var account = await _dbContext.Accounts
				.AsNoTracking()
				.Include(account => account.StaffMember)
				.Include(account => account.Owner)
				.FirstOrDefaultAsync(account => account.Email == email, cancellationToken);

		// The codes say which demo account exists, so the client can show the
		// mockup's hints. Accepted for the demo only; production answers the
		// same way for every failure (S.5).
		if (account?.PasswordHash is null)
		{
			return SignInFailed("unknownAccount");
		}

		if (!account.IsActive)
		{
			return SignInFailed("inactiveAccount");
		}

		var verification = PasswordHasher.VerifyHashedPassword(account, account.PasswordHash, request.Password);

		if (verification == PasswordVerificationResult.Failed)
		{
			return SignInFailed("wrongPassword");
		}

		return SignIn(CreatePrincipal(account), BearerTokenDefaults.AuthenticationScheme);
	}

	[HttpGet("me")]
	[Authorize]
	public ActionResult<SignedInUserDto> Me()
	{
		return new SignedInUserDto
		{
			Name = User.FindFirstValue(ClaimTypes.Name)!,
			Experience = Enum.Parse<AccountKind>(User.FindFirstValue(AuthNames.KindClaim)!)
		};
	}

	// Only the id, kind and display name: never the email, phone or hash.
	private static ClaimsPrincipal CreatePrincipal(Account account)
	{
		var name = account.Kind == AccountKind.TeamMember
			? $"{account.StaffMember!.FirstName} {account.StaffMember.LastName}"
			: $"{account.Owner!.FirstName} {account.Owner.LastName}";

		var identity = new ClaimsIdentity(
			[
				new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
				new Claim(ClaimTypes.Name, name),
				new Claim(AuthNames.KindClaim, account.Kind.ToString())
			],
			BearerTokenDefaults.AuthenticationScheme);

		return new ClaimsPrincipal(identity);
	}

	private ObjectResult SignInFailed(string code)
	{
		var result = Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Sign-in failed");
		((ProblemDetails)result.Value!).Extensions["code"] = code;
		return result;
	}
}
