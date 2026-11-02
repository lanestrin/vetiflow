using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Staff-set task priority and the staff-designated Next Care Action (build
    /// plan 4.13a). Existing tasks keep a null priority and are not designated:
    /// nothing is defaulted or chosen. At most one task per case may be
    /// designated, and a designation records who and when. The plain case index
    /// becomes (EmergencyCaseId, Status), so the designation index can use
    /// EmergencyCaseId alone.
    /// </summary>
    public partial class AddTaskPriority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CaseTasks_EmergencyCaseId",
                table: "CaseTasks");

            migrationBuilder.AddColumn<bool>(
                name: "IsNextAction",
                table: "CaseTasks",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "NextActionDesignatedAt",
                table: "CaseTasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "NextActionDesignatedByStaffId",
                table: "CaseTasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "CaseTasks",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_EmergencyCaseId_NextAction",
                table: "CaseTasks",
                column: "EmergencyCaseId",
                unique: true,
                filter: "\"IsNextAction\"");

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_EmergencyCaseId_Status",
                table: "CaseTasks",
                columns: new[] { "EmergencyCaseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_NextActionDesignatedByStaffId",
                table: "CaseTasks",
                column: "NextActionDesignatedByStaffId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_CaseTasks_NextActionRecorded",
                table: "CaseTasks",
                sql: "NOT \"IsNextAction\" OR (\"NextActionDesignatedAt\" IS NOT NULL AND \"NextActionDesignatedByStaffId\" IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_CaseTasks_StaffMembers_NextActionDesignatedByStaffId",
                table: "CaseTasks",
                column: "NextActionDesignatedByStaffId",
                principalTable: "StaffMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CaseTasks_StaffMembers_NextActionDesignatedByStaffId",
                table: "CaseTasks");

            migrationBuilder.DropIndex(
                name: "IX_CaseTasks_EmergencyCaseId_NextAction",
                table: "CaseTasks");

            migrationBuilder.DropIndex(
                name: "IX_CaseTasks_EmergencyCaseId_Status",
                table: "CaseTasks");

            migrationBuilder.DropIndex(
                name: "IX_CaseTasks_NextActionDesignatedByStaffId",
                table: "CaseTasks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_CaseTasks_NextActionRecorded",
                table: "CaseTasks");

            migrationBuilder.DropColumn(
                name: "IsNextAction",
                table: "CaseTasks");

            migrationBuilder.DropColumn(
                name: "NextActionDesignatedAt",
                table: "CaseTasks");

            migrationBuilder.DropColumn(
                name: "NextActionDesignatedByStaffId",
                table: "CaseTasks");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "CaseTasks");

            migrationBuilder.CreateIndex(
                name: "IX_CaseTasks_EmergencyCaseId",
                table: "CaseTasks",
                column: "EmergencyCaseId");
        }
    }
}
