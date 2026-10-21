using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <summary>
    /// A manager or crew member can work in more than one territory: Users.TerritoryId becomes the
    /// UserTerritories list, starting with the territory each person was in.
    /// </summary>
    public partial class UserTerritories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserTerritories",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TerritoryId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTerritories", x => new { x.UserId, x.TerritoryId });
                    table.ForeignKey(
                        name: "FK_UserTerritories_Territories_TerritoryId",
                        column: x => x.TerritoryId,
                        principalTable: "Territories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserTerritories_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserTerritories_TerritoryId",
                table: "UserTerritories",
                column: "TerritoryId");

            // Everyone keeps the territory they were in.
            migrationBuilder.Sql("""
                INSERT INTO "UserTerritories" ("UserId", "TerritoryId")
                SELECT "Id", "TerritoryId" FROM "Users" WHERE "TerritoryId" IS NOT NULL;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Territories_TerritoryId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_TerritoryId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TerritoryId",
                table: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TerritoryId",
                table: "Users",
                type: "integer",
                nullable: true);

            // Back to one territory each: the first they were in.
            migrationBuilder.Sql("""
                UPDATE "Users" u SET "TerritoryId" = (
                    SELECT MIN(ut."TerritoryId") FROM "UserTerritories" ut WHERE ut."UserId" = u."Id");
                """);

            migrationBuilder.DropTable(
                name: "UserTerritories");

            migrationBuilder.CreateIndex(
                name: "IX_Users_TerritoryId",
                table: "Users",
                column: "TerritoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Territories_TerritoryId",
                table: "Users",
                column: "TerritoryId",
                principalTable: "Territories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
