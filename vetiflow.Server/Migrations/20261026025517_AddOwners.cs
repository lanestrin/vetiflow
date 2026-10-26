using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddOwners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "Patients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastOwnerUpdateAt",
                table: "EmergencyCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerUpdateStatus",
                table: "EmergencyCases",
                type: "text",
                nullable: false,
                // Existing cases need a valid enum name, not EF's default ''.
                // A literal, so renaming the enum later cannot change this migration.
                defaultValue: "NotYetUpdated");

            migrationBuilder.CreateTable(
                name: "Owners",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstName = table.Column<string>(type: "text", nullable: false),
                    LastName = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Owners", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Patients_OwnerId",
                table: "Patients",
                column: "OwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Patients_Owners_OwnerId",
                table: "Patients",
                column: "OwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Patients_Owners_OwnerId",
                table: "Patients");

            migrationBuilder.DropTable(
                name: "Owners");

            migrationBuilder.DropIndex(
                name: "IX_Patients_OwnerId",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "LastOwnerUpdateAt",
                table: "EmergencyCases");

            migrationBuilder.DropColumn(
                name: "OwnerUpdateStatus",
                table: "EmergencyCases");
        }
    }
}
