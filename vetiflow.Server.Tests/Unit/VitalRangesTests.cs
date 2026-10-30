using vetiflow.Server.Models;

namespace vetiflow.Server.Tests.Unit;

public class VitalRangesTests
{
	[Fact]
	public void OutOfRange_DogMiloPrototypeSet_FlagsHeartRespAndSpO2()
	{
		// The prototype's Milo: 148 bpm, 48 /min, 38.9 °C, 91%.
		var outOfRange = VitalRanges.OutOfRange("Dog", 148, 48, 102.0m, 91);

		Assert.Equal(["heartRate", "respiratoryRate", "spO2"], outOfRange);
	}

	[Theory]
	[InlineData("Dog", 60, 10, 99.5, 95)]
	[InlineData("Dog", 140, 30, 102.6, 100)]
	[InlineData("Cat", 140, 20, 100.0, 95)]
	[InlineData("Cat", 220, 40, 102.6, 100)]
	public void OutOfRange_ValuesOnTheBounds_AreInRange(
		string species,
		int heartRate,
		int respiratoryRate,
		double temperatureF,
		int spO2)
	{
		var outOfRange = VitalRanges.OutOfRange(species, heartRate, respiratoryRate, (decimal)temperatureF, spO2);

		Assert.Empty(outOfRange);
	}

	[Fact]
	public void OutOfRange_JustOutsideTheBounds_FlagsEachReading()
	{
		Assert.Equal(
			["heartRate", "respiratoryRate", "temperatureF", "spO2"],
			VitalRanges.OutOfRange("Cat", 139, 41, 99.9m, 94));
	}

	[Fact]
	public void OutOfRange_MissingReadings_AreNotFlagged()
	{
		var outOfRange = VitalRanges.OutOfRange("Dog", null, null, null, null);

		Assert.Empty(outOfRange);
	}

	[Theory]
	[InlineData("dog")]
	[InlineData("DOG")]
	[InlineData(" Dog ")]
	public void OutOfRange_SpeciesIgnoresCase(string species)
	{
		var outOfRange = VitalRanges.OutOfRange(species, 200, null, null, null);

		Assert.Equal(["heartRate"], outOfRange);
	}

	[Fact]
	public void OutOfRange_UnknownSpecies_FlagsNothing()
	{
		var outOfRange = VitalRanges.OutOfRange("Rabbit", 300, 80, 106.0m, 80);

		Assert.Empty(outOfRange);
	}
}
