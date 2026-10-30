using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddPainScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PainScores",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmergencyCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RecordedByStaffId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PainScores", x => x.Id);
                    table.CheckConstraint("CK_PainScores_ScoreZeroToTen", "\"Score\" BETWEEN 0 AND 10");
                    table.ForeignKey(
                        name: "FK_PainScores_EmergencyCases_EmergencyCaseId",
                        column: x => x.EmergencyCaseId,
                        principalTable: "EmergencyCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PainScores_StaffMembers_RecordedByStaffId",
                        column: x => x.RecordedByStaffId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PainScores_EmergencyCaseId_RecordedAt",
                table: "PainScores",
                columns: new[] { "EmergencyCaseId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PainScores_RecordedByStaffId",
                table: "PainScores",
                column: "RecordedByStaffId");

            // Like every table: hidden from Supabase's anon and authenticated
            // roles, readable and writable by the API's vetiflow_app role.
            migrationBuilder.Sql("ALTER TABLE \"PainScores\" ENABLE ROW LEVEL SECURITY;");
            AppRoleAccess.Grant(migrationBuilder, "PainScores");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PainScores");
        }
    }
}
