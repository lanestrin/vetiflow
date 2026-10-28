namespace vetiflow.Server.Contracts.Cases;

// One set of vitals; any reading may be missing.
public class VitalsRecordDto
{
	public Guid Id { get; set; }

	public int? HeartRate { get; set; }

	public int? RespiratoryRate { get; set; }

	public decimal? TemperatureF { get; set; }

	public string? MucousMembraneColor { get; set; }

	public string? CapillaryRefillTime { get; set; }

	public string? Mentation { get; set; }

	public DateTimeOffset RecordedAt { get; set; }

	public CaseReferenceDto? RecordedBy { get; set; }
}
