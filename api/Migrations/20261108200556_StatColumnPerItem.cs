using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class StatColumnPerItem : Migration
    {
        /// <summary>
        /// Gives each product its own stat-sheet column instead of its category's: every product
        /// takes the column its category had, so the stat sheet counts exactly as before.
        /// </summary>
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StatColumn",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.Sql("""
                UPDATE "Products" p
                SET "StatColumn" = c."StatColumn"
                FROM "Categories" c
                WHERE c."Id" = p."CategoryId";
                """);

            migrationBuilder.DropColumn(
                name: "StatColumn",
                table: "Categories");
        }

        /// <summary>
        /// Back to a column per category: each takes the column most of its products count in.
        /// </summary>
        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StatColumn",
                table: "Categories",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.Sql("""
                UPDATE "Categories" c
                SET "StatColumn" = (
                    SELECT p."StatColumn" FROM "Products" p
                    WHERE p."CategoryId" = c."Id"
                    GROUP BY p."StatColumn"
                    ORDER BY count(*) DESC, p."StatColumn"
                    LIMIT 1)
                WHERE EXISTS (SELECT 1 FROM "Products" p WHERE p."CategoryId" = c."Id");
                """);

            migrationBuilder.DropColumn(
                name: "StatColumn",
                table: "Products");
        }
    }
}
