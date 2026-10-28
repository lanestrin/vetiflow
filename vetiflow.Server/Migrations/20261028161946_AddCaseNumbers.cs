using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Case numbers for staff ("ER-2481", build plan 3.4a). The database
    /// assigns each new case the next number from the CaseNumbers sequence.
    /// Adding the column numbers existing rows in no particular order, so they
    /// are renumbered by arrival, and the sequence moves past the highest.
    /// </summary>
    public partial class AddCaseNumbers : Migration
    {
        private const string FirstNumber = "2401";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence<int>(
                name: "CaseNumbers",
                startValue: 2401L);

            migrationBuilder.AddColumn<int>(
                name: "CaseNumber",
                table: "EmergencyCases",
                type: "integer",
                nullable: false,
                defaultValueSql: "nextval('\"CaseNumbers\"')");

            migrationBuilder.Sql($"""
                UPDATE "EmergencyCases" AS c
                SET "CaseNumber" = numbered."Number"
                FROM (
                    SELECT "Id", {FirstNumber} - 1 + row_number() OVER (ORDER BY "ArrivalTime", "Id") AS "Number"
                    FROM "EmergencyCases"
                ) AS numbered
                WHERE c."Id" = numbered."Id";
                """);

            // The next case continues after the highest number (2401 when there are none).
            migrationBuilder.Sql($"""
                SELECT setval('"CaseNumbers"', COALESCE(MAX("CaseNumber"), {FirstNumber} - 1))
                FROM "EmergencyCases";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyCases_CaseNumber",
                table: "EmergencyCases",
                column: "CaseNumber",
                unique: true);

            // The app role inserts cases, so it draws numbers from the sequence.
            migrationBuilder.Sql($"GRANT USAGE ON SEQUENCE \"CaseNumbers\" TO {AppRoleAccess.Role};");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EmergencyCases_CaseNumber",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "CaseNumber",
                table: "EmergencyCases");

            // Dropping the sequence also drops the app role's grant on it.
            migrationBuilder.DropSequence(
                name: "CaseNumbers");
        }
    }
}
