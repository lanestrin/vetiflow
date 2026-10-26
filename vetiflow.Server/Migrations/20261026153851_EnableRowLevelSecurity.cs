using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Supabase serves every table in "public" to its anon and authenticated
    /// roles through the REST and GraphQL APIs. Row level security with no
    /// policies leaves those roles nothing. The API connects as the tables'
    /// owner, which RLS does not restrict (no FORCE). A migration that adds a
    /// table must enable RLS on it too (RowLevelSecurityTests checks).
    /// </summary>
    public partial class EnableRowLevelSecurity : Migration
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
            "__EFMigrationsHistory"
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" ENABLE ROW LEVEL SECURITY;");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" DISABLE ROW LEVEL SECURITY;");
            }
        }
    }
}
