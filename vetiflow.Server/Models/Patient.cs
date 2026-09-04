namespace vetiflow.Server.Models;

public class Patient
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public required string Name { get; set; }

	public required string Species { get; set; }

	public string? Breed { get; set; }

	public string? Sex { get; set; }

	public DateOnly? DateOfBirth { get; set; }
}