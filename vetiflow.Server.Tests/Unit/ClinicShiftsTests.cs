using Microsoft.Extensions.Configuration;
using vetiflow.Server.Hosting;

namespace vetiflow.Server.Tests.Unit;

// The clinic's fixed shifts (build plan 2.12a, decided 2026-10-28): Day from
// 08:00 and Night from 20:00 on the clinic's own clock. Chicago is UTC-5 in
// late October (CDT) and UTC-6 from 1 November 2026 (CST).
public class ClinicShiftsTests
{
	private static readonly ClinicShifts Chicago = ClinicShifts.FromConfiguration(Settings(new()
	{
		["Clinic:TimeZone"] = "America/Chicago",
		["Clinic:DayShiftStarts"] = "08:00",
		["Clinic:NightShiftStarts"] = "20:00"
	}));

	[Fact]
	public void CurrentShift_MidMorning_IsDayFromEight()
	{
		var shift = Chicago.At(Utc("2026-10-28T15:00:00Z"));

		Assert.Equal(new CurrentShift(ShiftName.Day, Utc("2026-10-28T13:00:00Z")), shift);
	}

	[Fact]
	public void CurrentShift_Evening_IsNightFromEight()
	{
		var shift = Chicago.At(Utc("2026-10-30T02:00:00Z"));

		Assert.Equal(new CurrentShift(ShiftName.Night, Utc("2026-10-30T01:00:00Z")), shift);
	}

	[Fact]
	public void CurrentShift_EarlyMorning_IsNightFromYesterdayEvening()
	{
		var shift = Chicago.At(Utc("2026-10-28T08:00:00Z"));

		Assert.Equal(new CurrentShift(ShiftName.Night, Utc("2026-10-28T01:00:00Z")), shift);
	}

	[Fact]
	public void CurrentShift_AtExactlyEight_IsDay()
	{
		var shift = Chicago.At(Utc("2026-10-28T13:00:00Z"));

		Assert.Equal(new CurrentShift(ShiftName.Day, Utc("2026-10-28T13:00:00Z")), shift);
	}

	// Clocks go back at 02:00 on 1 November 2026: the night shift began at
	// 20:00 CDT the evening before, and the day shift at 08:00 CST.
	[Fact]
	public void CurrentShift_AcrossDaylightSavingEnd_UsesLocalClock()
	{
		Assert.Equal(
			new CurrentShift(ShiftName.Night, Utc("2026-11-01T01:00:00Z")),
			Chicago.At(Utc("2026-11-01T09:00:00Z")));
		Assert.Equal(
			new CurrentShift(ShiftName.Day, Utc("2026-11-01T14:00:00Z")),
			Chicago.At(Utc("2026-11-01T16:00:00Z")));
	}

	[Fact]
	public void FromConfiguration_UnknownTimeZone_Throws()
	{
		var exception = Assert.Throws<InvalidOperationException>(() => ClinicShifts.FromConfiguration(Settings(new()
		{
			["Clinic:TimeZone"] = "Mars/Olympus_Mons",
			["Clinic:DayShiftStarts"] = "08:00",
			["Clinic:NightShiftStarts"] = "20:00"
		})));

		Assert.Contains("Clinic:TimeZone", exception.Message);
	}

	[Theory]
	[InlineData("8 o'clock", "20:00", "Clinic:DayShiftStarts")]
	[InlineData("08:00", "", "Clinic:NightShiftStarts")]
	[InlineData("20:00", "08:00", "Clinic:DayShiftStarts")]
	public void FromConfiguration_BadTime_Throws(string dayStarts, string nightStarts, string setting)
	{
		var exception = Assert.Throws<InvalidOperationException>(() => ClinicShifts.FromConfiguration(Settings(new()
		{
			["Clinic:TimeZone"] = "America/Chicago",
			["Clinic:DayShiftStarts"] = dayStarts,
			["Clinic:NightShiftStarts"] = nightStarts
		})));

		Assert.Contains(setting, exception.Message);
	}

	private static DateTimeOffset Utc(string value) => DateTimeOffset.Parse(value);

	private static IConfiguration Settings(Dictionary<string, string?> values) =>
		new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
