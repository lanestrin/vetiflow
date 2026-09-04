namespace vetiflow.Server.Models;

public class TriageAssessment
{
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid EmergencyCaseId { get; set; }

	public EmergencyCase EmergencyCase { get; set; } = null!;

	public AcuityLevel Acuity { get; set; }

	public int? HeartRate { get; set; }

	public int? RespiratoryRate { get; set; }

	public decimal? TemperatureF { get; set; }

	public string? MucousMembraneColor { get; set; }

	public string? CapillaryRefillTime { get; set; }

	public string? Mentation { get; set; }

	public string? RawIntakeNotes { get; set; }

	public DateTimeOffset AssessedAt { get; set; } = DateTimeOffset.UtcNow;

	public Guid? AssessedByStaffId { get; set; }
}