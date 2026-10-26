using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Renames the acuity Stable to High (build plan 0.3). Enums are stored by
    /// name, so EF sees no schema change; every column that stores AcuityLevel
    /// is updated here. Literals, not nameof, so a later rename cannot change
    /// what this migration does.
    /// </summary>
    public partial class RenameStableAcuityToHigh : Migration
    {
        private static readonly string[] AcuityTables = ["EmergencyCases", "TriageAssessments"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in AcuityTables)
            {
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"Acuity\" = 'High' WHERE \"Acuity\" = 'Stable';");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in AcuityTables)
            {
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"Acuity\" = 'Stable' WHERE \"Acuity\" = 'High';");
            }
        }
    }
}
