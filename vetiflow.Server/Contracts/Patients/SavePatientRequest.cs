using System.ComponentModel.DataAnnotations;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Patients;

// Creates a patient, or replaces every field of one: a field left out is
// cleared, and a null OwnerId leaves the patient with no owner. The owner
// must exist and the date of birth can't be in the future; PatientsController
// checks both.
public class SavePatientRequest
{
	private string? _name;
	private string? _species;
	private string? _breed;

	[Required]
	[StringLength(100)]
	public string? Name { get => _name; set => _name = TextInput.Clean(value); }

	// Free text, as stored today ("Dog", "Cat").
	[Required]
	[StringLength(50)]
	public string? Species { get => _species; set => _species = TextInput.Clean(value); }

	[StringLength(100)]
	public string? Breed { get => _breed; set => _breed = TextInput.Clean(value); }

	// Null means not recorded yet.
	public PatientSex? Sex { get; set; }

	public DateOnly? DateOfBirth { get; set; }

	public Guid? OwnerId { get; set; }
}
