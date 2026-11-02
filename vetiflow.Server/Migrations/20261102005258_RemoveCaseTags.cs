using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Free-text case tags are removed until a clinic-approved list exists
    /// (build plan 3.5c, decided 2026-11-02); the stored tags are dropped. Past
    /// TagAdded and TagRemoved timeline entries stay in CaseEvents. Down
    /// recreates the empty table as AddCaseTags did.
    /// </summary>
    public partial class RemoveCaseTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            AppRoleAccess.Revoke(migrationBuilder, "CaseTags");

            migrationBuilder.DropTable(
                name: "CaseTags");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CaseTags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    EmergencyCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Text = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Tone = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseTags", x => x.Id);
                    table.CheckConstraint("CK_CaseTags_TextNotBlank", "length(btrim(\"Text\")) > 0");
                    table.ForeignKey(
                        name: "FK_CaseTags_EmergencyCases_EmergencyCaseId",
                        column: x => x.EmergencyCaseId,
                        principalTable: "EmergencyCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CaseTags_StaffMembers_CreatedByStaffId",
                        column: x => x.CreatedByStaffId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CaseTags_CreatedByStaffId",
                table: "CaseTags",
                column: "CreatedByStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseTags_EmergencyCaseId",
                table: "CaseTags",
                column: "EmergencyCaseId");

            migrationBuilder.Sql("ALTER TABLE \"CaseTags\" ENABLE ROW LEVEL SECURITY;");
            AppRoleAccess.Grant(migrationBuilder, "CaseTags");
        }
    }
}
