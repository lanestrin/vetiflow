namespace vetiflow.Server.Models;

public enum PatientSex
{
	MaleIntact,
	MaleNeutered,
	FemaleIntact,
	FemaleSpayed
}

public class Patient
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string Name { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }

	// Null means not yet recorded.
	public PatientSex? Sex { get; set; }

	public DateOnly? DateOfBirth { get; set; }
}
