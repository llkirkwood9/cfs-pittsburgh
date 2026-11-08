using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class NamedCategories : Migration
    {
        /// <summary>
        /// Turns the fixed categories into each territory's own list. Every territory gets one
        /// category per old value - named as the screens showed them, in the same order - and
        /// every product moves into its territory's category for its old value, so no item loses
        /// its place. Products from before every territory had its own catalog (no territory yet)
        /// go in the first territory's, which keeps them when the global catalog is split.
        /// </summary>
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    StatColumn = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    TerritoryId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Categories_Territories_TerritoryId",
                        column: x => x.TerritoryId,
                        principalTable: "Territories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_TerritoryId_SortOrder",
                table: "Categories",
                columns: new[] { "TerritoryId", "SortOrder" });

            // Global products with no territory at all to go to get the first one, as splitting
            // the global catalog would make.
            migrationBuilder.Sql("""
                INSERT INTO "Territories" ("Name", "IsActive", "CreatedAt")
                SELECT 'Pittsburgh', TRUE, now() AT TIME ZONE 'utc'
                WHERE NOT EXISTS (SELECT 1 FROM "Territories")
                  AND EXISTS (SELECT 1 FROM "Products" WHERE "TerritoryId" IS NULL);
                """);

            migrationBuilder.Sql("""
                INSERT INTO "Categories" ("Name", "StatColumn", "SortOrder", "TerritoryId")
                SELECT d.name, d.column_value, d.sort_order, t."Id"
                FROM "Territories" t
                CROSS JOIN (VALUES
                    ('Mattresses', 0, 1),
                    ('Adjustable Bases', 1, 2),
                    ('Pillows', 2, 3),
                    ('Sheets', 3, 4),
                    ('Mattress Protectors', 4, 5),
                    ('Frames', 5, 6),
                    ('Bean Bag Chairs', 6, 7),
                    ('Other', 7, 8)
                ) AS d(name, column_value, sort_order)
                ORDER BY t."Id", d.sort_order;
                """);

            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "Products",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Products" p
                SET "CategoryId" = c."Id"
                FROM "Categories" c
                WHERE c."TerritoryId" = COALESCE(p."TerritoryId", (SELECT MIN("Id") FROM "Territories"))
                  AND c."StatColumn" = p."Category";
                """);

            // A value outside the old list, which nothing should have stored, goes in Other.
            migrationBuilder.Sql("""
                UPDATE "Products" p
                SET "CategoryId" = c."Id"
                FROM "Categories" c
                WHERE p."CategoryId" IS NULL
                  AND c."TerritoryId" = COALESCE(p."TerritoryId", (SELECT MIN("Id") FROM "Territories"))
                  AND c."StatColumn" = 7;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "CategoryId",
                table: "Products",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.DropIndex(
                name: "IX_Products_Category_SortOrder",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Products");

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId_SortOrder",
                table: "Products",
                columns: new[] { "CategoryId", "SortOrder" });

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Categories_CategoryId",
                table: "Products",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <summary>
        /// Back to the fixed categories: each product takes the stat-sheet column of its category.
        /// The categories' names and order are lost.
        /// </summary>
        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Category",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.Sql("""
                UPDATE "Products" p
                SET "Category" = c."StatColumn"
                FROM "Categories" c
                WHERE c."Id" = p."CategoryId";
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_Products_Categories_CategoryId",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_CategoryId_SortOrder",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Products");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Category_SortOrder",
                table: "Products",
                columns: new[] { "Category", "SortOrder" });
        }
    }
}
