using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Fields the New patient intake records (build plan 4.1a). Existing cases
    /// get NotDiscussed for treatment authorization, a valid enum name.
    /// </summary>
    public partial class AddIntakeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Allergies",
                table: "Patients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentMedications",
                table: "Patients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DateOfBirthIsEstimated",
                table: "Patients",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "AllergiesAtIntake",
                table: "EmergencyCases",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MedicationsAtIntake",
                table: "EmergencyCases",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferringClinic",
                table: "EmergencyCases",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TreatmentAuthorization",
                table: "EmergencyCases",
                type: "text",
                nullable: false,
                defaultValue: "NotDiscussed");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Allergies",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "CurrentMedications",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "DateOfBirthIsEstimated",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "AllergiesAtIntake",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "MedicationsAtIntake",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "ReferringClinic",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "TreatmentAuthorization",
                table: "EmergencyCases");
        }
    }
}
