using vetiflow.Server.Contracts.Owners;
using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Patients;

// One patient with its owner, for hospital team members.
public class PatientDto
{
	public Guid Id { get; set; }

	public required string Name { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }

	public PatientSex? Sex { get; set; }

	public DateOnly? DateOfBirth { get; set; }

	public OwnerDto? Owner { get; set; }

	// The patient's Owner must be loaded when it has one.
	public static PatientDto From(Patient patient) => new()
	{
		Id = patient.Id,
		Name = patient.Name,
		Species = patient.Species,
		Breed = patient.Breed,
		Sex = patient.Sex,
		DateOfBirth = patient.DateOfBirth,
		Owner = patient.Owner is null ? null : OwnerDto.From(patient.Owner)
	};
}
