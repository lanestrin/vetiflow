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
	private readonly IConfiguration _configuration;

	public AuthController(VetiFlowDbContext dbContext, IConfiguration configuration)
	{
		_dbContext = dbContext;
		_configuration = configuration;
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

	// Demo phone sign-in. Sending the code is simulated in the browser, so this
	// is the only phone step: the number and the fixed demo code (DemoSignIn).
	[HttpPost("phone/verify")]
	[AllowAnonymous]
	public async Task<IActionResult> VerifyPhoneSignIn(
		PhoneVerifyRequest request,
		CancellationToken cancellationToken)
	{
		if (!IsPhoneSignInOn())
		{
			return PhoneSignInOff();
		}

		if (!DemoSignIn.TryNormalizePhone(request.PhoneNumber, out var phoneNumber))
		{
			return InvalidPhoneNumber();
		}

		var account = await FindByPhoneAsync(phoneNumber, cancellationToken);

		if (account is null)
		{
			return SignInFailed("unknownPhone");
		}

		if (!account.IsActive)
		{
			return SignInFailed("inactiveAccount");
		}

		if (request.Code != DemoSignIn.Code)
		{
			return SignInFailed("wrongCode");
		}

		return SignIn(CreatePrincipal(account), BearerTokenDefaults.AuthenticationScheme);
	}

	// Read from the account, not the token's claims, so the profile follows
	// the current staff record. A token can outlive its account: then 401.
	[HttpGet("me")]
	[Authorize]
	public async Task<ActionResult<SignedInUserDto>> Me(CancellationToken cancellationToken)
	{
		var accountId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

		var account = await _dbContext.Accounts
				.AsNoTracking()
				.Include(account => account.StaffMember)
				.Include(account => account.Owner)
				.FirstOrDefaultAsync(account => account.Id == accountId, cancellationToken);

		if (account is null)
		{
			return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Signed-in account not found");
		}

		return SignedInUserDto.From(account);
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

	// The fixed code must never work where the setting is off (production with
	// real data), so phone sign-in is refused outright there.
	private bool IsPhoneSignInOn() => _configuration.GetValue<bool>(DemoSignIn.EnabledSetting);

	private ObjectResult PhoneSignInOff()
	{
		var result = Problem(statusCode: StatusCodes.Status403Forbidden, title: "Phone sign-in is off");
		((ProblemDetails)result.Value!).Extensions["code"] = "phoneSignInOff";
		return result;
	}

	private ActionResult InvalidPhoneNumber()
	{
		ModelState.AddModelError("phoneNumber", "Enter a 10-digit US mobile number.");
		return ValidationProblem(ModelState);
	}

	private Task<Account?> FindByPhoneAsync(string phoneNumber, CancellationToken cancellationToken) =>
		_dbContext.Accounts
				.AsNoTracking()
				.Include(account => account.StaffMember)
				.Include(account => account.Owner)
				.FirstOrDefaultAsync(account => account.PhoneNumber == phoneNumber, cancellationToken);
}
