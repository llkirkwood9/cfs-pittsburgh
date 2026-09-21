using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class ProductBundles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductVariantComponents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BundleVariantId = table.Column<int>(type: "int", nullable: false),
                    ComponentVariantId = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductVariantComponents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductVariantComponents_ProductVariants_BundleVariantId",
                        column: x => x.BundleVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductVariantComponents_ProductVariants_ComponentVariantId",
                        column: x => x.ComponentVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariantComponents_BundleVariantId_ComponentVariantId",
                table: "ProductVariantComponents",
                columns: new[] { "BundleVariantId", "ComponentVariantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariantComponents_ComponentVariantId",
                table: "ProductVariantComponents",
                column: "ComponentVariantId");

            // Carry existing mattress-and-base sets over: each flagged variant is linked to the
            // standalone adjustable base whose name starts with the set's configuration model
            // (IMC61, ES200) in the same size.
            migrationBuilder.Sql(@"
INSERT INTO ProductVariantComponents (BundleVariantId, ComponentVariantId, Quantity)
SELECT bv.Id, match.Id, 1
FROM ProductVariants bv
JOIN Products bp ON bp.Id = bv.ProductId
CROSS APPLY (
    SELECT TOP 1 cv.Id
    FROM ProductVariants cv
    JOIN Products cp ON cp.Id = cv.ProductId
    WHERE cp.Category = 1
      AND cp.Id <> bp.Id
      AND cv.Size = bv.Size
      AND cp.Name LIKE LEFT(LTRIM(bv.Configuration), CHARINDEX(' ', LTRIM(bv.Configuration) + ' ') - 1) + '%'
    ORDER BY cp.IsActive DESC, cv.IsActive DESC, cp.SortOrder, cv.SortOrder
) match
WHERE bv.IncludesAdjustableBase = 1
  AND bp.Category <> 1
  AND bv.Configuration IS NOT NULL;
");

            migrationBuilder.DropColumn(
                name: "IncludesAdjustableBase",
                table: "ProductVariants");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IncludesAdjustableBase",
                table: "ProductVariants",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(@"
UPDATE bv SET IncludesAdjustableBase = 1
FROM ProductVariants bv
WHERE EXISTS (
    SELECT 1 FROM ProductVariantComponents c
    JOIN ProductVariants cv ON cv.Id = c.ComponentVariantId
    JOIN Products cp ON cp.Id = cv.ProductId
    WHERE c.BundleVariantId = bv.Id AND cp.Category = 1);
");

            migrationBuilder.DropTable(
                name: "ProductVariantComponents");

        }
    }
}
