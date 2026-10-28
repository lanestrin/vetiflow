using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace vetiflow.Server.Migrations
{
    /// <summary>
    /// When each case entered its current stage (build plan 2.11a). No stage
    /// history is stored, so existing cases take their arrival time. Added as
    /// nullable, filled, then made required, so no placeholder default stays
    /// on the column.
    /// </summary>
    public partial class AddStageEnteredAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StageEnteredAt",
                table: "EmergencyCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql("""UPDATE "EmergencyCases" SET "StageEnteredAt" = "ArrivalTime";""");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "StageEnteredAt",
                table: "EmergencyCases",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StageEnteredAt",
                table: "EmergencyCases");
        }
    }
}
