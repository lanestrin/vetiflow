namespace vetiflow.Server.Hosting;

public enum ShiftName
{
	Day,
	Night
}

// The shift in progress and when it began.
public sealed record CurrentShift(ShiftName Name, DateTimeOffset StartedAt);

// The clinic's fixed shifts (build plan 2.12a, decided 2026-10-28): Day from
// Clinic:DayShiftStarts and Night from Clinic:NightShiftStarts, on the clinic's
// own clock in Clinic:TimeZone (an IANA name). Settings (9.3) takes them over
// later. Startup stops on a missing or malformed value.
public sealed class ClinicShifts
{
	public const string TimeZoneSetting = "Clinic:TimeZone";
	public const string DayShiftStartsSetting = "Clinic:DayShiftStarts";
	public const string NightShiftStartsSetting = "Clinic:NightShiftStarts";

	private readonly TimeZoneInfo _timeZone;
	private readonly TimeOnly _dayStarts;
	private readonly TimeOnly _nightStarts;

	private ClinicShifts(TimeZoneInfo timeZone, TimeOnly dayStarts, TimeOnly nightStarts)
	{
		_timeZone = timeZone;
		_dayStarts = dayStarts;
		_nightStarts = nightStarts;
	}

	public static ClinicShifts FromConfiguration(IConfiguration configuration)
	{
		var timeZoneName = configuration[TimeZoneSetting];
		if (string.IsNullOrWhiteSpace(timeZoneName)
			|| !TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneName, out var timeZone))
		{
			throw new InvalidOperationException(
				$"{TimeZoneSetting} must name the clinic's time zone, for example America/Chicago.");
		}

		var dayStarts = ReadTime(configuration, DayShiftStartsSetting);
		var nightStarts = ReadTime(configuration, NightShiftStartsSetting);
		if (dayStarts >= nightStarts)
		{
			throw new InvalidOperationException(
				$"{DayShiftStartsSetting} must be earlier in the day than {NightShiftStartsSetting}.");
		}

		return new ClinicShifts(timeZone, dayStarts, nightStarts);
	}

	public CurrentShift At(DateTimeOffset moment)
	{
		// Work on the local wall clock, then turn the local start into an
		// instant, so a daylight-saving day still starts at 08:00 local.
		var local = TimeZoneInfo.ConvertTime(moment, _timeZone).DateTime;
		var time = TimeOnly.FromDateTime(local);
		var today = DateOnly.FromDateTime(local);

		if (time >= _dayStarts && time < _nightStarts)
		{
			return new CurrentShift(ShiftName.Day, Instant(today.ToDateTime(_dayStarts)));
		}

		var nightDate = time >= _nightStarts ? today : today.AddDays(-1);
		return new CurrentShift(ShiftName.Night, Instant(nightDate.ToDateTime(_nightStarts)));
	}

	// In UTC: Npgsql only accepts offset 0 for timestamptz parameters.
	private DateTimeOffset Instant(DateTime localTime) =>
		new DateTimeOffset(localTime, _timeZone.GetUtcOffset(localTime)).ToUniversalTime();

	// "08:00". The setting's name, never its value, goes in the error.
	private static TimeOnly ReadTime(IConfiguration configuration, string setting)
	{
		if (!TimeOnly.TryParseExact(configuration[setting], "HH:mm", out var time))
		{
			throw new InvalidOperationException($"{setting} must be a 24-hour time such as 08:00.");
		}

		return time;
	}
}
