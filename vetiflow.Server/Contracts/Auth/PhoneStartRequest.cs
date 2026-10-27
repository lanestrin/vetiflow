using System.ComponentModel.DataAnnotations;

namespace vetiflow.Server.Contracts.Auth;

public class PhoneStartRequest
{
	// The format is checked by DemoSignIn.TryNormalizePhone.
	[Required]
	[StringLength(30)]
	public required string PhoneNumber { get; set; }
}
