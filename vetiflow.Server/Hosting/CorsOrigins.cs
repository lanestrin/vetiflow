namespace vetiflow.Server.Hosting;

// The browser origins allowed to call the API, from Cors:AllowedOrigins
// (Cors__AllowedOrigins__0 and so on in the environment). Startup stops on a
// missing or malformed list rather than allowing more than intended.
public static class CorsOrigins
{
	public const string SettingName = "Cors:AllowedOrigins";

	public static string[] Read(IConfiguration configuration)
	{
		var origins = configuration.GetSection(SettingName).Get<string[]>() ?? [];

		if (origins.Length == 0)
		{
			throw new InvalidOperationException(
				$"{SettingName} must list at least one origin, for example https://vetiflow.vercel.app.");
		}

		for (var index = 0; index < origins.Length; index++)
		{
			if (!IsHttpsOrigin(origins[index]))
			{
				// The index, not the value: configuration values stay out of errors.
				throw new InvalidOperationException(
					$"{SettingName} entry {index} must be an https origin with no path, " +
					"for example https://vetiflow.vercel.app. '*' is not allowed.");
			}
		}

		return origins;
	}

	// An origin is scheme, host and optional port, exactly as browsers send it:
	// no path, no trailing slash, no query and no user info.
	private static bool IsHttpsOrigin(string? origin) =>
		Uri.TryCreate(origin, UriKind.Absolute, out var uri)
		&& uri.Scheme == Uri.UriSchemeHttps
		&& uri.UserInfo.Length == 0
		&& string.Equals(origin, uri.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase);
}
