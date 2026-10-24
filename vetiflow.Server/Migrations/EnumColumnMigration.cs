using Microsoft.EntityFrameworkCore.Migrations;

namespace vetiflow.Server.Migrations;

// Converts enum columns between integer and text storage while keeping
// existing rows' meaning. It maps by the enums' current order, which is the
// order the integer values were written with, so only use it in the migration
// that switches storage to text; enum order no longer matters after that.
internal static class EnumColumnMigration
{
	public static void IntegerToText<TEnum>(
		MigrationBuilder migrationBuilder,
		string table,
		string column)
		where TEnum : struct, Enum
	{
		var cases = string.Join(" ", Enum.GetValues<TEnum>()
				.Select(value => $"WHEN {Convert.ToInt32(value)} THEN '{value}'"));

		migrationBuilder.Sql(
				$"ALTER TABLE \"{table}\" ALTER COLUMN \"{column}\" TYPE text " +
				$"USING (CASE \"{column}\" {cases} END);");
	}

	public static void TextToInteger<TEnum>(
		MigrationBuilder migrationBuilder,
		string table,
		string column)
		where TEnum : struct, Enum
	{
		var cases = string.Join(" ", Enum.GetValues<TEnum>()
				.Select(value => $"WHEN '{value}' THEN {Convert.ToInt32(value)}"));

		migrationBuilder.Sql(
				$"ALTER TABLE \"{table}\" ALTER COLUMN \"{column}\" TYPE integer " +
				$"USING (CASE \"{column}\" {cases} END);");
	}
}
