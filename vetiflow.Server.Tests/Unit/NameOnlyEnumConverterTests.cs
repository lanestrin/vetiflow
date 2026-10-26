using System.Text.Json;
using vetiflow.Server.Json;
using vetiflow.Server.Models;

namespace vetiflow.Server.Tests.Unit;

public class NameOnlyEnumConverterTests
{
	private static readonly JsonSerializerOptions Options = new()
	{
		Converters = { new NameOnlyEnumConverter() }
	};

	[Theory]
	[InlineData("\"treatment\"", CaseStage.Treatment)]
	[InlineData("\"Treatment\"", CaseStage.Treatment)]
	[InlineData("\"readyForNextStep\"", CaseStatus.ReadyForNextStep)]
	public void Read_KnownName_ReturnsValue(string json, object expected)
	{
		var value = JsonSerializer.Deserialize(json, expected.GetType(), Options);

		Assert.Equal(expected, value);
	}

	// "triage,treatment" would otherwise become Triage | Treatment = Diagnostics.
	[Theory]
	[InlineData("2")]
	[InlineData("\"2\"")]
	[InlineData("\"triage,treatment\"")]
	[InlineData("\"surgery\"")]
	[InlineData("\"\"")]
	[InlineData("null")]
	public void Read_AnythingButOneName_Throws(string json)
	{
		Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CaseStage>(json, Options));
	}

	[Fact]
	public void Write_UsesCamelCaseName()
	{
		var json = JsonSerializer.Serialize(CaseStatus.ReadyForNextStep, Options);

		Assert.Equal("\"readyForNextStep\"", json);
	}

	[Fact]
	public void NullableEnum_RoundTripsNull()
	{
		var json = JsonSerializer.Serialize<AcuityLevel?>(null, Options);
		var value = JsonSerializer.Deserialize<AcuityLevel?>("null", Options);

		Assert.Equal("null", json);
		Assert.Null(value);
	}
}
