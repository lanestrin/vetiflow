using Microsoft.EntityFrameworkCore.Migrations;

namespace vetiflow.Server.Migrations;

// In production the API connects as vetiflow_app, which owns no table, so it
// cannot change the schema. Row level security shows a non-owner nothing
// without a policy, so every table gets the role's rows through Grant. A
// migration that adds a table calls Grant for it (AppRoleTests checks).
internal static class AppRoleAccess
{
	public const string Role = "vetiflow_app";

	private const string Policy = "vetiflow_app_rows";

	// DELETE is granted for now; build plan 8.13 revokes it once the schema is final.
	public static void Grant(MigrationBuilder migrationBuilder, string table)
	{
		migrationBuilder.Sql($"GRANT SELECT, INSERT, UPDATE, DELETE ON \"{table}\" TO {Role};");
		migrationBuilder.Sql(
				$"CREATE POLICY {Policy} ON \"{table}\" FOR ALL TO {Role} USING (true) WITH CHECK (true);");
	}

	// For tables the app only reads, such as the migration history it checks at startup.
	public static void GrantRead(MigrationBuilder migrationBuilder, string table)
	{
		migrationBuilder.Sql($"GRANT SELECT ON \"{table}\" TO {Role};");
		migrationBuilder.Sql($"CREATE POLICY {Policy} ON \"{table}\" FOR SELECT TO {Role} USING (true);");
	}

	public static void Revoke(MigrationBuilder migrationBuilder, string table)
	{
		migrationBuilder.Sql($"DROP POLICY IF EXISTS {Policy} ON \"{table}\";");
		migrationBuilder.Sql($"REVOKE ALL ON \"{table}\" FROM {Role};");
	}
}
