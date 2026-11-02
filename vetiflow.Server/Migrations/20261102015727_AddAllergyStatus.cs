using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Structured allergy status on the patient and on each visit's intake
    /// (build plan 4.12a). Existing text becomes UnknownOrUnverified, never a
    /// verified state; blank or missing text becomes NotRecorded with no text.
    /// </summary>
    public partial class AddAllergyStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AllergiesVerifiedAt",
                table: "Patients",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AllergiesVerifiedByStaffId",
                table: "Patients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AllergySource",
                table: "Patients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AllergyStatus",
                table: "Patients",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AllergyStatusAtIntake",
                table: "EmergencyCases",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE "Patients" SET "Allergies" = NULLIF(btrim("Allergies"), '');
                UPDATE "Patients" SET "AllergyStatus" =
                    CASE WHEN "Allergies" IS NULL THEN 'NotRecorded' ELSE 'UnknownOrUnverified' END;
                UPDATE "EmergencyCases" SET "AllergiesAtIntake" = NULLIF(btrim("AllergiesAtIntake"), '');
                UPDATE "EmergencyCases" SET "AllergyStatusAtIntake" =
                    CASE WHEN "AllergiesAtIntake" IS NULL THEN 'NotRecorded' ELSE 'UnknownOrUnverified' END;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Patients_AllergiesVerifiedByStaffId",
                table: "Patients",
                column: "AllergiesVerifiedByStaffId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Patients_AllergyStatus",
                table: "Patients",
                sql: "(\"AllergyStatus\" = 'NotRecorded' AND \"Allergies\" IS NULL AND \"AllergySource\" IS NULL AND \"AllergiesVerifiedAt\" IS NULL AND \"AllergiesVerifiedByStaffId\" IS NULL) OR (\"AllergyStatus\" = 'UnknownOrUnverified' AND \"AllergiesVerifiedAt\" IS NULL AND \"AllergiesVerifiedByStaffId\" IS NULL) OR (\"AllergyStatus\" = 'NoKnownAllergies' AND \"Allergies\" IS NULL AND \"AllergiesVerifiedAt\" IS NOT NULL AND \"AllergiesVerifiedByStaffId\" IS NOT NULL) OR (\"AllergyStatus\" = 'DocumentedAllergies' AND \"Allergies\" IS NOT NULL AND length(btrim(\"Allergies\")) > 0 AND \"AllergiesVerifiedAt\" IS NOT NULL AND \"AllergiesVerifiedByStaffId\" IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EmergencyCases_AllergyStatusAtIntake",
                table: "EmergencyCases",
                sql: "(\"AllergyStatusAtIntake\" = 'NotRecorded' AND \"AllergiesAtIntake\" IS NULL) OR (\"AllergyStatusAtIntake\" = 'UnknownOrUnverified' AND \"AllergiesAtIntake\" IS NOT NULL AND length(btrim(\"AllergiesAtIntake\")) > 0)");

            migrationBuilder.AddForeignKey(
                name: "FK_Patients_StaffMembers_AllergiesVerifiedByStaffId",
                table: "Patients",
                column: "AllergiesVerifiedByStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Patients_StaffMembers_AllergiesVerifiedByStaffId",
                table: "Patients");

            migrationBuilder.DropIndex(
                name: "IX_Patients_AllergiesVerifiedByStaffId",
                table: "Patients");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Patients_AllergyStatus",
                table: "Patients");

            migrationBuilder.DropCheckConstraint(
                name: "CK_EmergencyCases_AllergyStatusAtIntake",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "AllergiesVerifiedAt",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "AllergiesVerifiedByStaffId",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "AllergySource",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "AllergyStatus",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "AllergyStatusAtIntake",
                table: "EmergencyCases");
        }
    }
}
