using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// Sign-in accounts for the demo (build plan S.16): each links to exactly
    /// one staff member or owner, enforced by check constraints and unique
    /// indexes. Dropping the table in Down drops its policy and grants too.
    /// </summary>
    public partial class AddAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: true),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Accounts", x => x.Id);
                    table.CheckConstraint("CK_Accounts_EmailLowerCase", "\"Email\" = lower(\"Email\")");
                    table.CheckConstraint("CK_Accounts_HasEmailOrPhone", "\"Email\" IS NOT NULL OR \"PhoneNumber\" IS NOT NULL");
                    table.CheckConstraint("CK_Accounts_KindMatchesLink", "(\"Kind\" = 'TeamMember' AND \"StaffMemberId\" IS NOT NULL AND \"OwnerId\" IS NULL) OR (\"Kind\" = 'PetParent' AND \"OwnerId\" IS NOT NULL AND \"StaffMemberId\" IS NULL)");
                    table.CheckConstraint("CK_Accounts_PhoneFormat", "\"PhoneNumber\" ~ '^\\+1[0-9]{10}$'");
                    table.ForeignKey(
                        name: "FK_Accounts_Owners_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Owners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Accounts_StaffMembers_StaffMemberId",
                        column: x => x.StaffMemberId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_Email",
                table: "Accounts",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_OwnerId",
                table: "Accounts",
                column: "OwnerId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_PhoneNumber",
                table: "Accounts",
                column: "PhoneNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_StaffMemberId",
                table: "Accounts",
                column: "StaffMemberId",
                unique: true);

            // Like every table: hidden from Supabase's anon and authenticated
            // roles, readable and writable by the API's vetiflow_app role.
            migrationBuilder.Sql("ALTER TABLE \"Accounts\" ENABLE ROW LEVEL SECURITY;");
            AppRoleAccess.Grant(migrationBuilder, "Accounts");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Accounts");
        }
    }
}
