using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class ProductWarranty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasWarranty",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WarrantyLength",
                table: "Products",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasWarranty",
                table: "OrderLines",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WarrantyLength",
                table: "OrderLines",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            // Mattresses and adjustable bases come with a manufacturer warranty.
            migrationBuilder.Sql(@"UPDATE ""Products"" SET ""HasWarranty"" = TRUE WHERE ""Category"" IN (0, 1);");

            // Lines already on orders take their product's warranty, so open orders ask correctly.
            migrationBuilder.Sql(@"
                UPDATE ""OrderLines"" l
                SET ""HasWarranty"" = p.""HasWarranty""
                FROM ""ProductVariants"" v
                JOIN ""Products"" p ON p.""Id"" = v.""ProductId""
                WHERE l.""ProductVariantId"" = v.""Id"";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasWarranty",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "WarrantyLength",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "HasWarranty",
                table: "OrderLines");

            migrationBuilder.DropColumn(
                name: "WarrantyLength",
                table: "OrderLines");
        }
    }
}
