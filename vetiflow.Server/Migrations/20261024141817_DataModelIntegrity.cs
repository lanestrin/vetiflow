using System;
using Microsoft.EntityFrameworkCore.Migrations;
using vetiflow.Server.Models;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class DataModelIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"Patients\" SET \"Sex\" = NULL WHERE \"Sex\" NOT IN ('MaleIntact','MaleNeutered','FemaleIntact','FemaleSpayed');");

            migrationBuilder.DropForeignKey(
                name: "FK_AiSummaries_EmergencyCases_EmergencyCaseId",
                table: "AiSummaries");

            migrationBuilder.DropForeignKey(
                name: "FK_CaseEvents_EmergencyCases_EmergencyCaseId",
                table: "CaseEvents");

            migrationBuilder.DropForeignKey(
                name: "FK_EmergencyCases_Patients_PatientId",
                table: "EmergencyCases");

            migrationBuilder.DropForeignKey(
                name: "FK_Handoffs_EmergencyCases_EmergencyCaseId",
                table: "Handoffs");

            migrationBuilder.DropForeignKey(
                name: "FK_TriageAssessments_EmergencyCases_EmergencyCaseId",
                table: "TriageAssessments");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyCases_PatientId",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "IsAvailable",
                table: "Rooms");

            EnumColumnMigration.IntegerToText<AcuityLevel>(migrationBuilder, "TriageAssessments", "Acuity");

            EnumColumnMigration.IntegerToText<StaffRole>(migrationBuilder, "StaffMembers", "Role");

            EnumColumnMigration.IntegerToText<RoomType>(migrationBuilder, "Rooms", "Type");

            EnumColumnMigration.IntegerToText<CaseStatus>(migrationBuilder, "EmergencyCases", "Status");

            EnumColumnMigration.IntegerToText<CaseStage>(migrationBuilder, "EmergencyCases", "Stage");

            EnumColumnMigration.IntegerToText<AcuityLevel>(migrationBuilder, "EmergencyCases", "Acuity");

            EnumColumnMigration.IntegerToText<CaseEventType>(migrationBuilder, "CaseEvents", "Type");

            EnumColumnMigration.IntegerToText<AiSummaryType>(migrationBuilder, "AiSummaries", "Type");

            EnumColumnMigration.IntegerToText<AiSummaryStatus>(migrationBuilder, "AiSummaries", "Status");

            migrationBuilder.CreateTable(
                name: "CaseTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmergencyCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    DueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AssignedToStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ResolvedByStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CaseTasks_EmergencyCases_EmergencyCaseId",
                        column: x => x.EmergencyCaseId,
                        principalTable: "EmergencyCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CaseTasks_StaffMembers_AssignedToStaffId",
                        column: x => x.AssignedToStaffId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CaseTasks_StaffMembers_CreatedByStaffId",
                        column: x => x.CreatedByStaffId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CaseTasks_StaffMembers_ResolvedByStaffId",
                        column: x => x.ResolvedByStaffId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TriageAssessments_AssessedByStaffId",
                table: "TriageAssessments",
                column: "AssessedByStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_Handoffs_FromStaffId",
                table: "Handoffs",
                column: "FromStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_Handoffs_ToStaffId",
                table: "Handoffs",
                column: "ToStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyCases_AssignedDoctorId",
                table: "EmergencyCases",
                column: "AssignedDoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyCases_AssignedTechnicianId",
                table: "EmergencyCases",
                column: "AssignedTechnicianId");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyCases_PatientId_Active",
                table: "EmergencyCases",
                column: "PatientId",
                unique: true,
                filter: "\"DischargedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyCases_RoomId_Active",
                table: "EmergencyCases",
                column: "RoomId",
                unique: true,
                filter: "\"DischargedAt\" IS NULL AND \"RoomId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CaseEvents_CreatedByStaffId",
                table: "CaseEvents",
                column: "CreatedByStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_AiSummaries_ReviewedByStaffId",
                table: "AiSummaries",
                column: "ReviewedByStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_AssignedToStaffId",
                table: "CaseTasks",
                column: "AssignedToStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_CreatedByStaffId",
                table: "CaseTasks",
                column: "CreatedByStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_EmergencyCaseId",
                table: "CaseTasks",
                column: "EmergencyCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_ResolvedByStaffId",
                table: "CaseTasks",
                column: "ResolvedByStaffId");

            migrationBuilder.AddForeignKey(
                name: "FK_AiSummaries_EmergencyCases_EmergencyCaseId",
                table: "AiSummaries",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AiSummaries_StaffMembers_ReviewedByStaffId",
                table: "AiSummaries",
                column: "ReviewedByStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CaseEvents_EmergencyCases_EmergencyCaseId",
                table: "CaseEvents",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CaseEvents_StaffMembers_CreatedByStaffId",
                table: "CaseEvents",
                column: "CreatedByStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EmergencyCases_Patients_PatientId",
                table: "EmergencyCases",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EmergencyCases_Rooms_RoomId",
                table: "EmergencyCases",
                column: "RoomId",
                principalTable: "Rooms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EmergencyCases_StaffMembers_AssignedDoctorId",
                table: "EmergencyCases",
                column: "AssignedDoctorId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EmergencyCases_StaffMembers_AssignedTechnicianId",
                table: "EmergencyCases",
                column: "AssignedTechnicianId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Handoffs_EmergencyCases_EmergencyCaseId",
                table: "Handoffs",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Handoffs_StaffMembers_FromStaffId",
                table: "Handoffs",
                column: "FromStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Handoffs_StaffMembers_ToStaffId",
                table: "Handoffs",
                column: "ToStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TriageAssessments_EmergencyCases_EmergencyCaseId",
                table: "TriageAssessments",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TriageAssessments_StaffMembers_AssessedByStaffId",
                table: "TriageAssessments",
                column: "AssessedByStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AiSummaries_EmergencyCases_EmergencyCaseId",
                table: "AiSummaries");

            migrationBuilder.DropForeignKey(
                name: "FK_AiSummaries_StaffMembers_ReviewedByStaffId",
                table: "AiSummaries");

            migrationBuilder.DropForeignKey(
                name: "FK_CaseEvents_EmergencyCases_EmergencyCaseId",
                table: "CaseEvents");

            migrationBuilder.DropForeignKey(
                name: "FK_CaseEvents_StaffMembers_CreatedByStaffId",
                table: "CaseEvents");

            migrationBuilder.DropForeignKey(
                name: "FK_EmergencyCases_Patients_PatientId",
                table: "EmergencyCases");

            migrationBuilder.DropForeignKey(
                name: "FK_EmergencyCases_Rooms_RoomId",
                table: "EmergencyCases");

            migrationBuilder.DropForeignKey(
                name: "FK_EmergencyCases_StaffMembers_AssignedDoctorId",
                table: "EmergencyCases");

            migrationBuilder.DropForeignKey(
                name: "FK_EmergencyCases_StaffMembers_AssignedTechnicianId",
                table: "EmergencyCases");

            migrationBuilder.DropForeignKey(
                name: "FK_Handoffs_EmergencyCases_EmergencyCaseId",
                table: "Handoffs");

            migrationBuilder.DropForeignKey(
                name: "FK_Handoffs_StaffMembers_FromStaffId",
                table: "Handoffs");

            migrationBuilder.DropForeignKey(
                name: "FK_Handoffs_StaffMembers_ToStaffId",
                table: "Handoffs");

            migrationBuilder.DropForeignKey(
                name: "FK_TriageAssessments_EmergencyCases_EmergencyCaseId",
                table: "TriageAssessments");

            migrationBuilder.DropForeignKey(
                name: "FK_TriageAssessments_StaffMembers_AssessedByStaffId",
                table: "TriageAssessments");

            migrationBuilder.DropTable(
                name: "CaseTasks");

            migrationBuilder.DropIndex(
                name: "IX_TriageAssessments_AssessedByStaffId",
                table: "TriageAssessments");

            migrationBuilder.DropIndex(
                name: "IX_Handoffs_FromStaffId",
                table: "Handoffs");

            migrationBuilder.DropIndex(
                name: "IX_Handoffs_ToStaffId",
                table: "Handoffs");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyCases_AssignedDoctorId",
                table: "EmergencyCases");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyCases_AssignedTechnicianId",
                table: "EmergencyCases");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyCases_PatientId_Active",
                table: "EmergencyCases");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyCases_RoomId_Active",
                table: "EmergencyCases");

            migrationBuilder.DropIndex(
                name: "IX_CaseEvents_CreatedByStaffId",
                table: "CaseEvents");

            migrationBuilder.DropIndex(
                name: "IX_AiSummaries_ReviewedByStaffId",
                table: "AiSummaries");

            EnumColumnMigration.TextToInteger<AcuityLevel>(migrationBuilder, "TriageAssessments", "Acuity");

            EnumColumnMigration.TextToInteger<StaffRole>(migrationBuilder, "StaffMembers", "Role");

            EnumColumnMigration.TextToInteger<RoomType>(migrationBuilder, "Rooms", "Type");

            migrationBuilder.AddColumn<bool>(
                name: "IsAvailable",
                table: "Rooms",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            EnumColumnMigration.TextToInteger<CaseStatus>(migrationBuilder, "EmergencyCases", "Status");

            EnumColumnMigration.TextToInteger<CaseStage>(migrationBuilder, "EmergencyCases", "Stage");

            EnumColumnMigration.TextToInteger<AcuityLevel>(migrationBuilder, "EmergencyCases", "Acuity");

            EnumColumnMigration.TextToInteger<CaseEventType>(migrationBuilder, "CaseEvents", "Type");

            EnumColumnMigration.TextToInteger<AiSummaryType>(migrationBuilder, "AiSummaries", "Type");

            EnumColumnMigration.TextToInteger<AiSummaryStatus>(migrationBuilder, "AiSummaries", "Status");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyCases_PatientId",
                table: "EmergencyCases",
                column: "PatientId");

            migrationBuilder.AddForeignKey(
                name: "FK_AiSummaries_EmergencyCases_EmergencyCaseId",
                table: "AiSummaries",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CaseEvents_EmergencyCases_EmergencyCaseId",
                table: "CaseEvents",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_EmergencyCases_Patients_PatientId",
                table: "EmergencyCases",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Handoffs_EmergencyCases_EmergencyCaseId",
                table: "Handoffs",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TriageAssessments_EmergencyCases_EmergencyCaseId",
                table: "TriageAssessments",
                column: "EmergencyCaseId",
                principalTable: "EmergencyCases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
