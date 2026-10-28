using System.ComponentModel.DataAnnotations;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// The New patient intake form (build plan 4.1a). A new pet needs its name and
// species; an existing one is named by PatientId instead. The phone, notes,
// allergies and medications are personal or clinical: never log them, and
// errors name the field, never its value.
public class CaseIntakeRequest
{
	private const string PhoneMessage = "Enter a phone number with 7 to 15 digits.";

	private string? _petName;
	private string? _species;
	private string? _breed;
	private string? _age;
	private string? _ownerName;
	private string? _ownerPhone;
	private string? _chiefComplaint;
	private string? _triageNotes;
	private string? _allergies;
	private string? _medications;
	private string? _referringClinic;

	// An existing patient (from the Patients page or a duplicate warning).
	public Guid? PatientId { get; set; }

	[RequiredForNewPatient(ErrorMessage = "Enter the patient's name.")]
	[StringLength(100)]
	public string? PetName { get => _petName; set => _petName = TextInput.Clean(value); }

	// Free text, as stored today ("Dog", "Cat", "Other").
	[RequiredForNewPatient(ErrorMessage = "Choose the species.")]
	[StringLength(50)]
	public string? Species { get => _species; set => _species = TextInput.Clean(value); }

	[StringLength(100)]
	public string? Breed { get => _breed; set => _breed = TextInput.Clean(value); }

	// As typed: "8 years", "6 months". Becomes an estimated date of birth.
	[StringLength(30)]
	public string? Age { get => _age; set => _age = TextInput.Clean(value); }

	// "Pet parent / guardian": first and last name in one field.
	[Required]
	[StringLength(201)]
	[RegularExpression(@"^\S.*\s\S+$", ErrorMessage = "Enter the pet parent's first and last name.")]
	public string? OwnerName { get => _ownerName; set => _ownerName = TextInput.Clean(value); }

	[Required]
	[StringLength(30)]
	[RegularExpression(@"^(?:[ ()+.-]*[0-9]){7,15}[ ()+.-]*$", ErrorMessage = PhoneMessage)]
	public string? OwnerPhone { get => _ownerPhone; set => _ownerPhone = TextInput.Clean(value); }

	[Required]
	[StringLength(500)]
	public string? ChiefComplaint { get => _chiefComplaint; set => _chiefComplaint = TextInput.Clean(value); }

	// Provisional until a clinician completes triage.
	[Required]
	public AcuityLevel? Priority { get; set; }

	[StringLength(2000)]
	public string? TriageNotes { get => _triageNotes; set => _triageNotes = TextInput.Clean(value); }

	[StringLength(500)]
	public string? Allergies { get => _allergies; set => _allergies = TextInput.Clean(value); }

	[StringLength(500)]
	public string? Medications { get => _medications; set => _medications = TextInput.Clean(value); }

	public TreatmentAuthorization? TreatmentAuthorization { get; set; }

	[StringLength(150)]
	public string? ReferringClinic { get => _referringClinic; set => _referringClinic = TextInput.Clean(value); }

	// The digits of the phone, used to find a returning owner.
	public string PhoneDigits => new((OwnerPhone ?? "").Where(char.IsAsciiDigit).ToArray());

	// Split at the last space: "Jo Anne Mills" is Jo Anne / Mills.
	public (string FirstName, string LastName) SplitOwnerName()
	{
		var lastSpace = OwnerName!.LastIndexOf(' ');
		return (OwnerName[..lastSpace].Trim(), OwnerName[(lastSpace + 1)..]);
	}
}

// Required unless the request names an existing patient.
[AttributeUsage(AttributeTargets.Property)]
public sealed class RequiredForNewPatientAttribute : ValidationAttribute
{
	protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
	{
		var request = (CaseIntakeRequest)validationContext.ObjectInstance;

		return request.PatientId is null && value is null
			? new ValidationResult(ErrorMessage, [validationContext.MemberName!])
			: ValidationResult.Success;
	}
}
