using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Creates the vetiflow_app role the API connects as in production and
    /// gives it the rows of every table, but no table of its own, so it cannot
    /// change the schema. Migrations keep running as the tables' owner through
    /// ConnectionStrings:VetiFlowMigrations. The role is created without a
    /// password; production sets one by hand (project plan, section 8).
    /// </summary>
    public partial class AddAppRole : Migration
    {
        // Listed by name, so the migration says exactly what it changes.
        private static readonly string[] Tables =
        [
            "AiSummaries",
            "CaseEvents",
            "CaseTasks",
            "EmergencyCases",
            "Handoffs",
            "Owners",
            "Patients",
            "Rooms",
            "StaffMembers",
            "TriageAssessments",
            "VitalsRecords"
        ];

        private const string MigrationHistory = "__EFMigrationsHistory";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Roles are server-wide and several databases may migrate at once
            // (the tests do), so an existing role is fine.
            migrationBuilder.Sql($"""
                DO $$
                BEGIN
                    CREATE ROLE {AppRoleAccess.Role} NOLOGIN;
                EXCEPTION
                    WHEN duplicate_object OR unique_violation THEN NULL;
                END
                $$;
                """);
            migrationBuilder.Sql($"GRANT USAGE ON SCHEMA public TO {AppRoleAccess.Role};");

            foreach (var table in Tables)
            {
                AppRoleAccess.Grant(migrationBuilder, table);
            }

            // Read only: startup checks it for pending migrations.
            AppRoleAccess.GrantRead(migrationBuilder, MigrationHistory);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables.Append(MigrationHistory))
            {
                AppRoleAccess.Revoke(migrationBuilder, table);
            }

            // The role stays: other databases on the same server may use it.
            migrationBuilder.Sql($"REVOKE USAGE ON SCHEMA public FROM {AppRoleAccess.Role};");
        }
    }
}
