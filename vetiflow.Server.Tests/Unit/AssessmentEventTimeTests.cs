using vetiflow.Server.Contracts.Cases;

namespace vetiflow.Server.Tests.Unit;

public class AssessmentEventTimeTests
{
	[Fact]
	public void TryParse_AcceptsEntryInstantButRejectsEvenOneTickInTheFuture()
	{
		var enteredAt = new DateTimeOffset(2026, 10, 31, 19, 15, 0, TimeSpan.Zero);
		Assert.True(AssessmentEventTime.TryParse(enteredAt.ToString("O"), enteredAt, out var occurredAt));
		Assert.Equal(enteredAt, occurredAt);
		Assert.False(AssessmentEventTime.TryParse(enteredAt.AddTicks(1).ToString("O"), enteredAt, out _));
	}

	[Theory]
	[InlineData("2020-01-02T09:30:00Z")]
	[InlineData("2020-01-02T14:30:00+05:00")]
	[InlineData("2020-01-02T04:30:00-05:00")]
	public void TryParse_NormalizesEquivalentOffsets(string input)
	{
		Assert.True(AssessmentEventTime.TryParse(input, DateTimeOffset.UtcNow, out var occurredAt));
		Assert.Equal(new DateTimeOffset(2020, 1, 2, 9, 30, 0, TimeSpan.Zero), occurredAt);
		Assert.Equal(TimeSpan.Zero, occurredAt!.Value.Offset);
	}

	[Theory]
	[InlineData("2020-01-02T09:30:00Z ")]
	[InlineData("2020-01-02T09:30:00Z\n")]
	[InlineData("2020-01-02T09:30:00.12345678Z")]
	[InlineData("2020-01-02T09:30:00+99:00")]
	[InlineData("2020-01-02 09:30:00Z")]
	[InlineData("2020-01-02T09:30:00")]
	public void TryParse_RejectsNonContractFormats(string input)
	{
		Assert.False(AssessmentEventTime.TryParse(input, DateTimeOffset.UtcNow, out var occurredAt));
		Assert.Null(occurredAt);
	}

	[Fact]
	public void TryParse_NormalizesSubMicrosecondPrecisionForDatabaseReadback()
	{
		Assert.True(AssessmentEventTime.TryParse("2020-01-02T09:30:00.1234567Z", DateTimeOffset.UtcNow, out var occurredAt));
		Assert.Equal(new DateTimeOffset(2020, 1, 2, 9, 30, 0, TimeSpan.Zero).AddTicks(1234560), occurredAt);
	}
}
