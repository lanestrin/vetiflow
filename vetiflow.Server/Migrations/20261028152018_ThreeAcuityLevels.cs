using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Moves acuity to the prototype's three levels (build plan 0.4a): High
    /// folds into Urgent and Low becomes Stable. Enums are stored by name, so EF
    /// sees no schema change; every column that stores AcuityLevel is updated
    /// here. Literals, not nameof, so a later rename cannot change what this
    /// migration does. Down only restores Low: nothing records which Urgent rows
    /// were High.
    /// </summary>
    public partial class ThreeAcuityLevels : Migration
    {
        private static readonly string[] AcuityTables = ["EmergencyCases", "TriageAssessments"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in AcuityTables)
            {
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"Acuity\" = 'Urgent' WHERE \"Acuity\" = 'High';");
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"Acuity\" = 'Stable' WHERE \"Acuity\" = 'Low';");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in AcuityTables)
            {
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"Acuity\" = 'Low' WHERE \"Acuity\" = 'Stable';");
            }
        }
    }
}
