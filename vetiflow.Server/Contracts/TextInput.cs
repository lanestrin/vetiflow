namespace vetiflow.Server.Contracts;

// Form fields arrive with stray spaces, and an empty optional field as "".
// Requests clean each value as it is set, so validation and storage both see
// the trimmed text, and a blank field is null.
public static class TextInput
{
	public static string? Clean(string? value)
	{
		var trimmed = value?.Trim();
		return string.IsNullOrEmpty(trimmed) ? null : trimmed;
	}
}
