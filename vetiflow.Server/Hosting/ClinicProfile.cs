namespace vetiflow.Server.Hosting;

// Who the clinic is (build plan 2.15a): its name from Clinic:Name, shown in the
// board heading's eyebrow. Settings (9.3) takes it over later. Startup stops on
// a missing or blank value.
public sealed class ClinicProfile
{
	public const string NameSetting = "Clinic:Name";

	private ClinicProfile(string name)
	{
		Name = name;
	}

	public string Name { get; }

	public static ClinicProfile FromConfiguration(IConfiguration configuration)
	{
		var name = configuration[NameSetting]?.Trim();
		if (string.IsNullOrEmpty(name))
		{
			throw new InvalidOperationException(
				$"{NameSetting} must name the clinic, for example Northside Veterinary Emergency.");
		}

		return new ClinicProfile(name);
	}
}
