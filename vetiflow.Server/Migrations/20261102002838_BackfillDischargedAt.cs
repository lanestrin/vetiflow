using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Cases moved to the Discharge stage before 4.21a have no discharge time,
    /// so they stayed on the ER board and kept their room. They are discharged
    /// at the time they entered the stage. No timeline entry is written: who
    /// moved them, and when, is not known beyond that.
    /// </summary>
    public partial class BackfillDischargedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "EmergencyCases" SET "DischargedAt" = "StageEnteredAt"
                WHERE "Stage" = 'Discharge' AND "DischargedAt" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The filled rows can't be told apart from real discharges, and a
            // Discharge-stage case without a discharge time is not a valid state.
        }
    }
}
