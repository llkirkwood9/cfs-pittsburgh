using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryShowOnSalesSheet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ShowOnSalesSheet",
                table: "OrderLines",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowOnSalesSheet",
                table: "DeliveryOptions",
                type: "bit",
                nullable: false,
                defaultValue: true);

            // Take With is already shown by the Take With column on the item's own row, so its
            // no-charge shipping row is hidden from the printed sheet - on the option and on
            // existing orders alike. Every other option keeps printing as before.
            migrationBuilder.Sql(@"
UPDATE DeliveryOptions SET ShowOnSalesSheet = 0 WHERE IsTakeWith = 1;
UPDATE OrderLines SET ShowOnSalesSheet = 0
WHERE LineType = 1 AND TakeWith = 1 AND LineTotal = 0;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ShowOnSalesSheet",
                table: "OrderLines");

            migrationBuilder.DropColumn(
                name: "ShowOnSalesSheet",
                table: "DeliveryOptions");
        }
    }
}
