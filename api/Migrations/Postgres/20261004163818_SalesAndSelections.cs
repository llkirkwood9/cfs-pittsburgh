using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace api.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class SalesAndSelections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasOwnSale",
                table: "ProductVariants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountAmount",
                table: "ProductVariants",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountPercent",
                table: "ProductVariants",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountAmount",
                table: "Products",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountPercent",
                table: "Products",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChoicesJson",
                table: "OrderLines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountAmount",
                table: "OrderLines",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountPercent",
                table: "OrderLines",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StockKey",
                table: "OrderLines",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StockKey",
                table: "InventoryAdjustments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

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

            migrationBuilder.CreateTable(
                name: "ProductOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    TracksStock = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductOptions_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProductOptionChoices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductOptionId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PriceAdjustment = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductOptionChoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductOptionChoices_ProductOptions_ProductOptionId",
                        column: x => x.ProductOptionId,
                        principalTable: "ProductOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChoiceStocks_ProductVariantId_StockKey",
                table: "ChoiceStocks",
                columns: new[] { "ProductVariantId", "StockKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductOptionChoices_ProductOptionId",
                table: "ProductOptionChoices",
                column: "ProductOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductOptions_ProductId_SortOrder",
                table: "ProductOptions",
                columns: new[] { "ProductId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChoiceStocks");

            migrationBuilder.DropTable(
                name: "ProductOptionChoices");

            migrationBuilder.DropTable(
                name: "ProductOptions");

            migrationBuilder.DropColumn(
                name: "HasOwnSale",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "SaleDiscountAmount",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "SaleDiscountPercent",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "SaleDiscountAmount",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SaleDiscountPercent",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ChoicesJson",
                table: "OrderLines");

            migrationBuilder.DropColumn(
                name: "SaleDiscountAmount",
                table: "OrderLines");

            migrationBuilder.DropColumn(
                name: "SaleDiscountPercent",
                table: "OrderLines");

            migrationBuilder.DropColumn(
                name: "StockKey",
                table: "OrderLines");

            migrationBuilder.DropColumn(
                name: "StockKey",
                table: "InventoryAdjustments");
        }
    }
}
