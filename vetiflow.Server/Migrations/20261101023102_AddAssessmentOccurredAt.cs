using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddAssessmentOccurredAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OccurredAt",
                table: "VitalsRecords",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OccurredAt",
                table: "TriageAssessments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OccurredAt",
                table: "PainScores",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OccurredAt",
                table: "VitalsRecords");

            migrationBuilder.DropColumn(
                name: "OccurredAt",
                table: "TriageAssessments");

            migrationBuilder.DropColumn(
                name: "OccurredAt",
                table: "PainScores");
        }
    }
}
