using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class DeliverySales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasOwnSale",
                table: "ProductDeliveryOptions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountAmount",
                table: "ProductDeliveryOptions",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountPercent",
                table: "ProductDeliveryOptions",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountAmount",
                table: "DeliveryOptions",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleDiscountPercent",
                table: "DeliveryOptions",
                type: "numeric(18,4)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasOwnSale",
                table: "ProductDeliveryOptions");

            migrationBuilder.DropColumn(
                name: "SaleDiscountAmount",
                table: "ProductDeliveryOptions");

            migrationBuilder.DropColumn(
                name: "SaleDiscountPercent",
                table: "ProductDeliveryOptions");

            migrationBuilder.DropColumn(
                name: "SaleDiscountAmount",
                table: "DeliveryOptions");

            migrationBuilder.DropColumn(
                name: "SaleDiscountPercent",
                table: "DeliveryOptions");
        }
    }
}
