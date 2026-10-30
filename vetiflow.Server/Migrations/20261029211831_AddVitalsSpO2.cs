using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddVitalsSpO2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SpO2",
                table: "VitalsRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_VitalsRecords_SpO2Percent",
                table: "VitalsRecords",
                sql: "\"SpO2\" BETWEEN 0 AND 100");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_VitalsRecords_SpO2Percent",
                table: "VitalsRecords");

            migrationBuilder.DropColumn(
                name: "SpO2",
                table: "VitalsRecords");
        }
    }
}
