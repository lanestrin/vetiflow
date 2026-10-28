using vetiflow.Server.Models;

namespace vetiflow.Server.Tests.Unit;

// The intake form's age, as typed, becomes an estimated date of birth
// (decided 2026-10-28, build plan 4.1a).
public class IntakeAgeTests
{
	private static readonly DateOnly Today = new(2026, 10, 28);

	[Theory]
	[InlineData("8 years", "2018-10-28")]
	[InlineData("8 Years", "2018-10-28")]
	[InlineData("1 year", "2025-10-28")]
	[InlineData("8y", "2018-10-28")]
	[InlineData("8 yrs", "2018-10-28")]
	[InlineData("8", "2018-10-28")]
	[InlineData("6 months", "2026-04-28")]
	[InlineData("6mo", "2026-04-28")]
	[InlineData("1 month", "2026-09-28")]
	[InlineData("3 weeks", "2026-10-07")]
	[InlineData("3w", "2026-10-07")]
	[InlineData(" 8  years ", "2018-10-28")]
	public void TryEstimateDateOfBirth_ReadsTheUsualSpellings(string age, string expected)
	{
		Assert.True(IntakeAge.TryEstimateDateOfBirth(age, Today, out var dateOfBirth));
		Assert.Equal(DateOnly.Parse(expected), dateOfBirth);
	}

	[Theory]
	[InlineData("old")]
	[InlineData("eight years")]
	[InlineData("8 decades")]
	[InlineData("0")]
	[InlineData("0 months")]
	[InlineData("41 years")]
	[InlineData("-2 years")]
	[InlineData("2.5 years")]
	public void TryEstimateDateOfBirth_RefusesWhatItCannotRead(string age)
	{
		Assert.False(IntakeAge.TryEstimateDateOfBirth(age, Today, out _));
	}
}
