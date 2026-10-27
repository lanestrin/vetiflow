using System.ComponentModel.DataAnnotations;

namespace vetiflow.Server.Contracts.Auth;

public class PhoneVerifyRequest
{
	// The format is checked by DemoSignIn.TryNormalizePhone.
	[Required]
	[StringLength(30)]
	public required string PhoneNumber { get; set; }

	[Required]
	[RegularExpression("^[0-9]{6}$", ErrorMessage = "The code is 6 digits.")]
	public required string Code { get; set; }
}
