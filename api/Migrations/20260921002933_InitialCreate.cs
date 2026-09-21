using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DeliveryOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IsTaxable = table.Column<bool>(type: "bit", nullable: false),
                    IsTakeWith = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryOptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Events",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchoolName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Organization = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    EventDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CartName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SalesTaxRate = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CcProcessingFeeRate = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    NextOrderNumber = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Brand = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Category = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PinHash = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PinSalt = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RefreshToken = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RefreshTokenExpiry = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductDeliveryOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    DeliveryOptionId = table.Column<int>(type: "int", nullable: false),
                    PriceOverride = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductDeliveryOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductDeliveryOptions_DeliveryOptions_DeliveryOptionId",
                        column: x => x.DeliveryOptionId,
                        principalTable: "DeliveryOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductDeliveryOptions_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProductVariants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    Size = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Configuration = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Price = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    IncludesAdjustableBase = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductVariants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductVariants_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Orders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    OrderNumber = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    DraftLabel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SaleDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Organization = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    AdvertisingSource = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ReferralName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    CfsRepName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    BillingName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    BillingAddress = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    BillingUnit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BillingFloor = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BillingSuite = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BillingCity = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    BillingState = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BillingZip = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    BillingCell = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BillingAlt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BillingEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DeliverySameAsBilling = table.Column<bool>(type: "bit", nullable: false),
                    DeliveryName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    DeliveryAddress = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    DeliveryUnit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeliveryFloor = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeliverySuite = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeliveryCity = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DeliveryState = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeliveryZip = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    DeliveryCell = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeliveryAlt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeliveryEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Comments = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SalesTaxRate = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CcProcessingFeeRate = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Subtotal = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TaxAmount = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CcProcessingFee = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Total = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    BalanceDue = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    WarrantyInitials = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    DropShipInitials = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    AdvisoryInitials = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CustomerSignatureName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    SignedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReceivedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ReceivedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CompletedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Orders_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Orders_Users_CompletedByUserId",
                        column: x => x.CompletedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Orders_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OrderLines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    LineType = table.Column<int>(type: "int", nullable: false),
                    Category = table.Column<int>(type: "int", nullable: false),
                    ProductVariantId = table.Column<int>(type: "int", nullable: true),
                    DeliveryOptionId = table.Column<int>(type: "int", nullable: true),
                    ParentLineId = table.Column<int>(type: "int", nullable: true),
                    Brand = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Size = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    TakeWith = table.Column<bool>(type: "bit", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    DiscountPercent = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    DiscountAmount = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    SalePrice = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    LineTotal = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IncludesAdjustableBase = table.Column<bool>(type: "bit", nullable: false),
                    IsTaxable = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderLines_DeliveryOptions_DeliveryOptionId",
                        column: x => x.DeliveryOptionId,
                        principalTable: "DeliveryOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrderLines_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderLines_ProductVariants_ProductVariantId",
                        column: x => x.ProductVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OrderPayments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    Method = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CheckNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderPayments_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Events_EventDate",
                table: "Events",
                column: "EventDate");

            migrationBuilder.CreateIndex(
                name: "IX_OrderLines_DeliveryOptionId",
                table: "OrderLines",
                column: "DeliveryOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderLines_OrderId",
                table: "OrderLines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderLines_ProductVariantId",
                table: "OrderLines",
                column: "ProductVariantId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderPayments_OrderId",
                table: "OrderPayments",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CompletedByUserId",
                table: "Orders",
                column: "CompletedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CreatedByUserId",
                table: "Orders",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_EventId_OrderNumber",
                table: "Orders",
                columns: new[] { "EventId", "OrderNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Status",
                table: "Orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ProductDeliveryOptions_DeliveryOptionId",
                table: "ProductDeliveryOptions",
                column: "DeliveryOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductDeliveryOptions_ProductId_DeliveryOptionId",
                table: "ProductDeliveryOptions",
                columns: new[] { "ProductId", "DeliveryOptionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_Category_SortOrder",
                table: "Products",
                columns: new[] { "Category", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_ProductId",
                table: "ProductVariants",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderLines");

            migrationBuilder.DropTable(
                name: "OrderPayments");

            migrationBuilder.DropTable(
                name: "ProductDeliveryOptions");

            migrationBuilder.DropTable(
                name: "ProductVariants");

            migrationBuilder.DropTable(
                name: "Orders");

            migrationBuilder.DropTable(
                name: "DeliveryOptions");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Events");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
