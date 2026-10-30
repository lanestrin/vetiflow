using vetiflow.Server.Models;

namespace vetiflow.Server.Contracts.Cases;

// One set of vitals; any reading may be missing.
public class VitalsRecordDto
{
	public Guid Id { get; set; }

	public int? HeartRate { get; set; }

	public int? RespiratoryRate { get; set; }

	public decimal? TemperatureF { get; set; }

	// Oxygen saturation, in percent.
	public int? SpO2 { get; set; }

	public string? MucousMembraneColor { get; set; }

	public string? CapillaryRefillTime { get; set; }

	public string? Mentation { get; set; }

	public DateTimeOffset RecordedAt { get; set; }

	public CaseReferenceDto? RecordedBy { get; set; }

	// "heartRate", "respiratoryRate", "temperatureF" or "spO2" for each reading
	// outside the alert ranges (VitalRanges); empty when none are.
	public List<string> OutOfRange { get; set; } = [];

	// Not translatable to SQL, so it runs after the query.
	public void FlagOutOfRange(string species) =>
		OutOfRange = VitalRanges.OutOfRange(species, HeartRate, RespiratoryRate, TemperatureF, SpO2);
}
