using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddVetAssessment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "VetAssessedAt",
                table: "EmergencyCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "VetAssessedByStaffId",
                table: "EmergencyCases",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "VetAssessmentRecordedAt",
                table: "EmergencyCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyCases_VetAssessedByStaffId",
                table: "EmergencyCases",
                column: "VetAssessedByStaffId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EmergencyCases_VetAssessmentRecorded",
                table: "EmergencyCases",
                sql: "(\"VetAssessedAt\" IS NULL AND \"VetAssessmentRecordedAt\" IS NULL AND \"VetAssessedByStaffId\" IS NULL) OR (\"VetAssessedAt\" IS NOT NULL AND \"VetAssessmentRecordedAt\" IS NOT NULL AND \"VetAssessedByStaffId\" IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_EmergencyCases_StaffMembers_VetAssessedByStaffId",
                table: "EmergencyCases",
                column: "VetAssessedByStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmergencyCases_StaffMembers_VetAssessedByStaffId",
                table: "EmergencyCases");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyCases_VetAssessedByStaffId",
                table: "EmergencyCases");

            migrationBuilder.DropCheckConstraint(
                name: "CK_EmergencyCases_VetAssessmentRecorded",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "VetAssessedAt",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "VetAssessedByStaffId",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "VetAssessmentRecordedAt",
                table: "EmergencyCases");
        }
    }
}
