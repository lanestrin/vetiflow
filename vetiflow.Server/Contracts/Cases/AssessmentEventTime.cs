using System.Globalization;
using System.Text.RegularExpressions;

namespace vetiflow.Server.Contracts.Cases;

// Parse only explicit-offset event times. The caller supplies the server entry
// instant so validation and persistence use the same future-time boundary.
public static partial class AssessmentEventTime
{
	public static bool TryParse(string? value, DateTimeOffset enteredAt, out DateTimeOffset? occurredAt)
	{
		occurredAt = null;
		if (value is null) return true;
		if (value.Length > 33 || !TimestampPattern().IsMatch(value)
			|| !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
			|| parsed > enteredAt)
		{
			return false;
		}

		// Match Postgres precision so the write response equals later readback.
		var utc = parsed.ToUniversalTime();
		occurredAt = utc.AddTicks(-(utc.Ticks % TimeSpan.TicksPerMicrosecond));
		return true;
	}

	[GeneratedRegex(@"\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,7})?(?:Z|[+-][0-9]{2}:[0-9]{2})\z")]
	private static partial Regex TimestampPattern();
}
