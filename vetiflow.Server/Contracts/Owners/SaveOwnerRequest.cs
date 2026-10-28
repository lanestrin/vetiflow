using System.ComponentModel.DataAnnotations;

namespace vetiflow.Server.Contracts.Owners;

// Creates an owner, or replaces every field of one: a field left out is
// cleared.
public class SaveOwnerRequest
{
	private string? _firstName;
	private string? _lastName;
	private string? _phone;
	private string? _email;

	[Required]
	[StringLength(100)]
	public string? FirstName { get => _firstName; set => _firstName = TextInput.Clean(value); }

	[Required]
	[StringLength(100)]
	public string? LastName { get => _lastName; set => _lastName = TextInput.Clean(value); }

	// Stored as typed ("555-0101", "(312) 555-0101"): digits and the usual
	// separators, with at least one digit.
	[StringLength(30)]
	[RegularExpression(@"^[0-9 ()+.-]*[0-9][0-9 ()+.-]*$", ErrorMessage = "Enter a phone number using digits, spaces and ( ) + . -")]
	public string? Phone { get => _phone; set => _phone = TextInput.Clean(value); }

	[StringLength(254)]
	[EmailAddress]
	public string? Email { get => _email; set => _email = TextInput.Clean(value); }
}
