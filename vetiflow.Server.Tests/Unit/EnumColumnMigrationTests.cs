using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using vetiflow.Server.Migrations;

namespace vetiflow.Server.Tests.Unit;

public class EnumColumnMigrationTests
{
	private enum Color
	{
		Red,
		Green
	}

	[Fact]
	public void IntegerToText_MapsEachValueToItsName()
	{
		var migrationBuilder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");

		EnumColumnMigration.IntegerToText<Color>(migrationBuilder, "Things", "Color");

		var operation = Assert.IsType<SqlOperation>(Assert.Single(migrationBuilder.Operations));
		Assert.Equal(
			"ALTER TABLE \"Things\" ALTER COLUMN \"Color\" TYPE text " +
			"USING (CASE \"Color\" WHEN 0 THEN 'Red' WHEN 1 THEN 'Green' END);",
			operation.Sql);
	}

	[Fact]
	public void TextToInteger_MapsEachNameToItsValue()
	{
		var migrationBuilder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");

		EnumColumnMigration.TextToInteger<Color>(migrationBuilder, "Things", "Color");

		var operation = Assert.IsType<SqlOperation>(Assert.Single(migrationBuilder.Operations));
		Assert.Equal(
			"ALTER TABLE \"Things\" ALTER COLUMN \"Color\" TYPE integer " +
			"USING (CASE \"Color\" WHEN 'Red' THEN 0 WHEN 'Green' THEN 1 END);",
			operation.Sql);
	}
}
