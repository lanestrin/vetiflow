namespace vetiflow.Server.Models;

// The readings that turn a vital red on the panel (build plan 4.8a). These are
// demo ranges, not the clinic's: the "Vital alert ranges" decision is still
// open, and the clinic's numbers replace these before real clinic data. Bounds
// are inclusive. Species other than dog and cat get no flags.
public static class VitalRanges
{
	private record Range<T>(T Low, T High) where T : IComparable<T>
	{
		public bool Contains(T value) => value.CompareTo(Low) >= 0 && value.CompareTo(High) <= 0;
	}

	private record SpeciesRanges(
		Range<int> HeartRate,
		Range<int> RespiratoryRate,
		Range<decimal> TemperatureF,
		int MinimumSpO2);

	private static readonly Dictionary<string, SpeciesRanges> BySpecies = new(StringComparer.OrdinalIgnoreCase)
	{
		// Temperature 37.5 to 39.2 °C.
		["Dog"] = new(new(60, 140), new(10, 30), new(99.5m, 102.6m), 95),
		// Temperature 37.8 to 39.2 °C.
		["Cat"] = new(new(140, 220), new(20, 40), new(100.0m, 102.6m), 95)
	};

	// The JSON names of the readings outside the species' ranges; missing
	// readings are never flagged.
	public static List<string> OutOfRange(
		string species,
		int? heartRate,
		int? respiratoryRate,
		decimal? temperatureF,
		int? spO2)
	{
		var outOfRange = new List<string>();

		if (!BySpecies.TryGetValue(species.Trim(), out var ranges))
		{
			return outOfRange;
		}

		if (heartRate is { } beats && !ranges.HeartRate.Contains(beats))
		{
			outOfRange.Add("heartRate");
		}

		if (respiratoryRate is { } breaths && !ranges.RespiratoryRate.Contains(breaths))
		{
			outOfRange.Add("respiratoryRate");
		}

		if (temperatureF is { } temperature && !ranges.TemperatureF.Contains(temperature))
		{
			outOfRange.Add("temperatureF");
		}

		if (spO2 is { } saturation && saturation < ranges.MinimumSpO2)
		{
			outOfRange.Add("spO2");
		}

		return outOfRange;
	}
}
