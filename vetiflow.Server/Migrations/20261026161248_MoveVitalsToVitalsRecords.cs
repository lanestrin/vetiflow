using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Moves vitals off TriageAssessments into their own table, so a case can
    /// hold many sets and a recheck is not an acuity decision. The order matters:
    /// create the table, copy the vitals, then drop the old columns (EF generated
    /// the drops first, which would lose the data).
    /// </summary>
    public partial class MoveVitalsToVitalsRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VitalsRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmergencyCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    HeartRate = table.Column<int>(type: "integer", nullable: true),
                    RespiratoryRate = table.Column<int>(type: "integer", nullable: true),
                    TemperatureF = table.Column<decimal>(type: "numeric", nullable: true),
                    MucousMembraneColor = table.Column<string>(type: "text", nullable: true),
                    CapillaryRefillTime = table.Column<string>(type: "text", nullable: true),
                    Mentation = table.Column<string>(type: "text", nullable: true),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RecordedByStaffId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VitalsRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VitalsRecords_EmergencyCases_EmergencyCaseId",
                        column: x => x.EmergencyCaseId,
                        principalTable: "EmergencyCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VitalsRecords_StaffMembers_RecordedByStaffId",
                        column: x => x.RecordedByStaffId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VitalsRecords_EmergencyCaseId",
                table: "VitalsRecords",
                column: "EmergencyCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_VitalsRecords_RecordedByStaffId",
                table: "VitalsRecords",
                column: "RecordedByStaffId");

            // Every table in public has RLS (coding-standards, build plan S.13).
            migrationBuilder.Sql("ALTER TABLE \"VitalsRecords\" ENABLE ROW LEVEL SECURITY;");

            // Each record reuses its assessment's Id, so Down can copy the vitals
            // back to the right row. Assessments with no vitals get no record.
            migrationBuilder.Sql("""
                INSERT INTO "VitalsRecords"
                    ("Id", "EmergencyCaseId", "HeartRate", "RespiratoryRate", "TemperatureF",
                     "MucousMembraneColor", "CapillaryRefillTime", "Mentation",
                     "RecordedAt", "RecordedByStaffId")
                SELECT "Id", "EmergencyCaseId", "HeartRate", "RespiratoryRate", "TemperatureF",
                       "MucousMembraneColor", "CapillaryRefillTime", "Mentation",
                       "AssessedAt", "AssessedByStaffId"
                FROM "TriageAssessments"
                WHERE "HeartRate" IS NOT NULL OR "RespiratoryRate" IS NOT NULL
                   OR "TemperatureF" IS NOT NULL OR "MucousMembraneColor" IS NOT NULL
                   OR "CapillaryRefillTime" IS NOT NULL OR "Mentation" IS NOT NULL;
                """);

            foreach (var column in VitalsColumns)
            {
                migrationBuilder.DropColumn(name: column, table: "TriageAssessments");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(name: "HeartRate", table: "TriageAssessments", type: "integer", nullable: true);
            migrationBuilder.AddColumn<int>(name: "RespiratoryRate", table: "TriageAssessments", type: "integer", nullable: true);
            migrationBuilder.AddColumn<decimal>(name: "TemperatureF", table: "TriageAssessments", type: "numeric", nullable: true);
            migrationBuilder.AddColumn<string>(name: "MucousMembraneColor", table: "TriageAssessments", type: "text", nullable: true);
            migrationBuilder.AddColumn<string>(name: "CapillaryRefillTime", table: "TriageAssessments", type: "text", nullable: true);
            migrationBuilder.AddColumn<string>(name: "Mentation", table: "TriageAssessments", type: "text", nullable: true);

            // Records created after Up (rechecks) have no assessment to return to;
            // only the migrated ones, matched by Id, go back.
            migrationBuilder.Sql("""
                UPDATE "TriageAssessments" AS t
                SET "HeartRate" = v."HeartRate",
                    "RespiratoryRate" = v."RespiratoryRate",
                    "TemperatureF" = v."TemperatureF",
                    "MucousMembraneColor" = v."MucousMembraneColor",
                    "CapillaryRefillTime" = v."CapillaryRefillTime",
                    "Mentation" = v."Mentation"
                FROM "VitalsRecords" AS v
                WHERE v."Id" = t."Id";
                """);

            migrationBuilder.DropTable(name: "VitalsRecords");
        }

        private static readonly string[] VitalsColumns =
        [
            "HeartRate",
            "RespiratoryRate",
            "TemperatureF",
            "MucousMembraneColor",
            "CapillaryRefillTime",
            "Mentation"
        ];
    }
}
