using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing staff start Unavailable, as new ones do (build plan
            // 2.21a): nobody counts as on the floor until they say so.
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "StaffMembers",
                type: "text",
                nullable: false,
                defaultValue: "Unavailable");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "StaffMembers");
        }
    }
}
