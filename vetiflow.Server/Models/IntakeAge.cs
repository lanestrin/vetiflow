using System.Text.RegularExpressions;

namespace vetiflow.Server.Models;

// The intake form's age as typed ("8 years", "6 months", "3 weeks") becomes
// an estimated date of birth (decided 2026-10-28, build plan 4.1a), so the
// age on the board stays right as time passes. A bare number means years.
public static partial class IntakeAge
{
	private const int MaxYears = 40;

	public const string ErrorMessage = "Enter an age like 8 years, 6 months or 3 weeks.";

	public static bool TryEstimateDateOfBirth(string age, DateOnly today, out DateOnly dateOfBirth)
	{
		dateOfBirth = default;
		var match = AgePattern().Match(age.Trim());

		if (!match.Success || !int.TryParse(match.Groups["count"].Value, out var count) || count < 1)
		{
			return false;
		}

		var unit = match.Groups["unit"].Value.ToLowerInvariant();

		if (unit.StartsWith('w'))
		{
			dateOfBirth = today.AddDays(-7 * count);
			return count <= MaxYears * 52;
		}

		if (unit.StartsWith('m'))
		{
			dateOfBirth = today.AddMonths(-count);
			return count <= MaxYears * 12;
		}

		dateOfBirth = today.AddYears(-count);
		return count <= MaxYears;
	}

	[GeneratedRegex(@"^(?<count>\d{1,3})\s*(?<unit>years?|yrs?|y|months?|mos?|weeks?|wks?|w)?$", RegexOptions.IgnoreCase)]
	private static partial Regex AgePattern();
}
