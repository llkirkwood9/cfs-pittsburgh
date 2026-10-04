using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace api.Migrations.Postgres
{
    /// <summary>
    /// Stock counted per choice (such as a sheet color) moves into the per-territory
    /// InventoryStocks table, keyed by StockKey, and the single-location ChoiceStocks table from
    /// SalesAndSelections goes. Any counts already in it are carried over to the territory that
    /// took on the old single-location stock (Pittsburgh), or failing that the first territory.
    /// The other SalesAndSelections columns and tables are shared and stay as they are.
    /// </summary>
    public partial class ChoiceStockByTerritory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InventoryStocks_TerritoryId_ProductVariantId",
                table: "InventoryStocks");

            migrationBuilder.AddColumn<string>(
                name: "StockKey",
                table: "InventoryStocks",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryStocks_TerritoryId_ProductVariantId_StockKey",
                table: "InventoryStocks",
                columns: new[] { "TerritoryId", "ProductVariantId", "StockKey" },
                unique: true);

            migrationBuilder.Sql(
                "INSERT INTO \"InventoryStocks\" (\"TerritoryId\", \"ProductVariantId\", \"StockKey\", \"QuantityOnHand\") " +
                "SELECT t.\"Id\", c.\"ProductVariantId\", c.\"StockKey\", c.\"QuantityOnHand\" FROM \"ChoiceStocks\" c " +
                "CROSS JOIN (SELECT COALESCE((SELECT MIN(\"Id\") FROM \"Territories\" WHERE \"Name\" = 'Pittsburgh'), (SELECT MIN(\"Id\") FROM \"Territories\")) AS \"Id\") t " +
                "WHERE c.\"QuantityOnHand\" <> 0 AND c.\"StockKey\" <> '' AND t.\"Id\" IS NOT NULL;");

            migrationBuilder.DropTable(
                name: "ChoiceStocks");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChoiceStocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductVariantId = table.Column<int>(type: "integer", nullable: false),
                    StockKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    QuantityOnHand = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChoiceStocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChoiceStocks_ProductVariants_ProductVariantId",
                        column: x => x.ProductVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChoiceStocks_ProductVariantId_StockKey",
                table: "ChoiceStocks",
                columns: new[] { "ProductVariantId", "StockKey" },
                unique: true);

            // Per-choice counts can't keep their territory; they're dropped along with the key.
            migrationBuilder.Sql("DELETE FROM \"InventoryStocks\" WHERE \"StockKey\" <> '';");

            migrationBuilder.DropIndex(
                name: "IX_InventoryStocks_TerritoryId_ProductVariantId_StockKey",
                table: "InventoryStocks");

            migrationBuilder.DropColumn(
                name: "StockKey",
                table: "InventoryStocks");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryStocks_TerritoryId_ProductVariantId",
                table: "InventoryStocks",
                columns: new[] { "TerritoryId", "ProductVariantId" },
                unique: true);
        }
    }
}
