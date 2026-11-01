using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddCaseTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CaseTags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmergencyCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Tone = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByStaffId = table.Column<Guid>(type: "uuid", nullable: true)
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            AppRoleAccess.Revoke(migrationBuilder, "CaseTags");

            migrationBuilder.DropTable(
                name: "CaseTags");
        }
    }
}
