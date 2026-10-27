using System.ComponentModel.DataAnnotations;

namespace vetiflow.Server.Contracts.Auth;

public class EmailSignInRequest
{
	// [Required] also rejects an empty string, which `required` alone allows.
	[Required]
	[EmailAddress]
	[StringLength(254)]
	public required string Email { get; set; }

	[Required]
	[StringLength(128)]
	public required string Password { get; set; }
}
