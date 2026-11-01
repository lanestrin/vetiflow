using System.ComponentModel.DataAnnotations;

namespace vetiflow.Server.Contracts.Cases;

// A new set of vitals on a case (build plan 4.8a). Any reading may be left out,
// but not all of them. The limits refuse typos, not real readings; whether a
// reading is worrying is VitalRanges' job. Observations are clinical text:
// never log them, and errors name the field, never its value.
public class RecordVitalsRequest
{
	// Optional reported event time with an explicit offset; never entry time.
	[StringLength(33)]
	public string? OccurredAt { get; set; }

	private string? _mucousMembraneColor;
	private string? _capillaryRefillTime;
	private string? _mentation;

	[Range(1, 400)]
	public int? HeartRate { get; set; }

	[Range(1, 200)]
	public int? RespiratoryRate { get; set; }

	[Range(typeof(decimal), "80.0", "115.0", ParseLimitsInInvariantCulture = true)]
	public decimal? TemperatureF { get; set; }

	[Range(50, 100)]
	public int? SpO2 { get; set; }

	[StringLength(50)]
	public string? MucousMembraneColor { get => _mucousMembraneColor; set => _mucousMembraneColor = TextInput.Clean(value); }

	[StringLength(50)]
	public string? CapillaryRefillTime { get => _capillaryRefillTime; set => _capillaryRefillTime = TextInput.Clean(value); }

	[StringLength(50)]
	public string? Mentation { get => _mentation; set => _mentation = TextInput.Clean(value); }

	public bool HasAnyReading =>
		HeartRate is not null
		|| RespiratoryRate is not null
		|| TemperatureF is not null
		|| SpO2 is not null
		|| MucousMembraneColor is not null
		|| CapillaryRefillTime is not null
		|| Mentation is not null;
}
