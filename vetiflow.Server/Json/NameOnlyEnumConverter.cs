using System.Text.Json;
using System.Text.Json.Serialization;

namespace vetiflow.Server.Json;

// Reads and writes every enum as exactly one camelCase name. The built-in
// JsonStringEnumConverter also accepts numbers and comma lists, and it reads
// "triage,treatment" as Triage | Treatment, which is Diagnostics.
public sealed class NameOnlyEnumConverter : JsonConverterFactory
{
	public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

	public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
		(JsonConverter)Activator.CreateInstance(
			typeof(NameOnlyEnumConverter<>).MakeGenericType(typeToConvert))!;
}

public sealed class NameOnlyEnumConverter<TEnum> : JsonConverter<TEnum>
	where TEnum : struct, Enum
{
	// Case-insensitive, as before: the client sends "treatment", older callers
	// may send "Treatment".
	private static readonly Dictionary<string, TEnum> ValuesByName = Enum.GetValues<TEnum>()
		.ToDictionary(value => ToName(value), StringComparer.OrdinalIgnoreCase);

	public override TEnum Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
	{
		if (reader.TokenType == JsonTokenType.String
			&& ValuesByName.TryGetValue(reader.GetString()!, out var value))
		{
			return value;
		}

		throw new JsonException($"Expected one of: {string.Join(", ", ValuesByName.Keys)}.");
	}

	public override void Write(Utf8JsonWriter writer, TEnum value, JsonSerializerOptions options) =>
		writer.WriteStringValue(ToName(value));

	private static string ToName(TEnum value) =>
		JsonNamingPolicy.CamelCase.ConvertName(value.ToString());
}
