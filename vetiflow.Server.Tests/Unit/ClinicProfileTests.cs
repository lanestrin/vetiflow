using Microsoft.Extensions.Configuration;
using vetiflow.Server.Hosting;

namespace vetiflow.Server.Tests.Unit;

// The clinic's name for the board heading (build plan 2.15a).
public class ClinicProfileTests
{
	[Fact]
	public void FromConfiguration_ReadsTheNameTrimmed()
	{
		var profile = ClinicProfile.FromConfiguration(Settings(new()
		{
			["Clinic:Name"] = "  Northside Veterinary Emergency "
		}));

		Assert.Equal("Northside Veterinary Emergency", profile.Name);
	}

	[Theory]
	[InlineData(null)]
	[InlineData("")]
	[InlineData("   ")]
	public void FromConfiguration_MissingOrBlankName_Throws(string? name)
	{
		var exception = Assert.Throws<InvalidOperationException>(
			() => ClinicProfile.FromConfiguration(Settings(new() { ["Clinic:Name"] = name })));

		Assert.Contains("Clinic:Name", exception.Message);
	}

	private static IConfiguration Settings(Dictionary<string, string?> values) =>
		new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
