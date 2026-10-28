namespace vetiflow.Server.Contracts;

// The rules for a records search (owners and patients): a few characters at
// least, so a search never returns the whole table, and a capped result list.
public static class SearchText
{
	public const int MinLength = 2;

	public const int MaxLength = 100;

	public const int MaxResults = 25;

	public const string ErrorMessage = "Enter 2 to 100 characters to search.";

	public static bool TryClean(string? search, out string text)
	{
		text = TextInput.Clean(search) ?? "";
		return text.Length is >= MinLength and <= MaxLength;
	}

	// Pass to every EF.Functions.ILike with ContainsPattern: Npgsql turns
	// escaping off unless an escape character is given.
	public const string EscapeCharacter = @"\";

	// An ILIKE pattern matching the text anywhere. % and _ are wildcards, so
	// they and the escape character itself are escaped to match as typed.
	public static string ContainsPattern(string text)
	{
		var escaped = text
				.Replace(EscapeCharacter, EscapeCharacter + EscapeCharacter)
				.Replace("%", EscapeCharacter + "%")
				.Replace("_", EscapeCharacter + "_");

		return $"%{escaped}%";
	}
}
