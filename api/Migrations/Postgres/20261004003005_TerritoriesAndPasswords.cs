using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace api.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class TerritoriesAndPasswords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FailedLoginCount",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LockoutUntil",
                table: "Users",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "Users",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TerritoryId",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TerritoryId",
                table: "Products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TerritoryId",
                table: "InventoryAdjustments",
                type: "integer",
                nullable: true);

            // Nullable until the existing events have been given a territory, below.
            migrationBuilder.AddColumn<int>(
                name: "TerritoryId",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordChangedAt",
                table: "Users",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TerritoryId",
                table: "DeliveryOptions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Territories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Territories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UserAgent = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryStocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TerritoryId = table.Column<int>(type: "integer", nullable: false),
                    ProductVariantId = table.Column<int>(type: "integer", nullable: false),
                    QuantityOnHand = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryStocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryStocks_ProductVariants_ProductVariantId",
                        column: x => x.ProductVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InventoryStocks_Territories_TerritoryId",
                        column: x => x.TerritoryId,
                        principalTable: "Territories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TerritorySettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TerritoryId = table.Column<int>(type: "integer", nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Value = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TerritorySettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TerritorySettings_Territories_TerritoryId",
                        column: x => x.TerritoryId,
                        principalTable: "Territories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Existing events, crew and stock go into a first territory, "Pittsburgh", which can be
            // renamed afterwards. A database with nothing in it gets no territory here.
            migrationBuilder.Sql("INSERT INTO \"Territories\" (\"Name\", \"IsActive\", \"CreatedAt\") SELECT 'Pittsburgh', TRUE, (now() at time zone 'utc') WHERE EXISTS (SELECT 1 FROM \"Events\") OR EXISTS (SELECT 1 FROM \"Users\" WHERE \"Role\" IN (0, 1, 3)) OR EXISTS (SELECT 1 FROM \"ProductVariants\" WHERE \"QuantityOnHand\" <> 0);");

            migrationBuilder.Sql("UPDATE \"Events\" SET \"TerritoryId\" = (SELECT \"Id\" FROM \"Territories\" WHERE \"Name\" = 'Pittsburgh');");

            migrationBuilder.Sql("UPDATE \"Users\" SET \"TerritoryId\" = (SELECT \"Id\" FROM \"Territories\" WHERE \"Name\" = 'Pittsburgh') WHERE \"Role\" IN (0, 1, 3);");

            migrationBuilder.Sql("INSERT INTO \"InventoryStocks\" (\"TerritoryId\", \"ProductVariantId\", \"QuantityOnHand\") SELECT t.\"Id\", v.\"Id\", v.\"QuantityOnHand\" FROM \"ProductVariants\" v CROSS JOIN \"Territories\" t WHERE v.\"QuantityOnHand\" <> 0 AND t.\"Name\" = 'Pittsburgh';");

            migrationBuilder.Sql("UPDATE \"InventoryAdjustments\" SET \"TerritoryId\" = (SELECT \"Id\" FROM \"Territories\" WHERE \"Name\" = 'Pittsburgh');");

            migrationBuilder.AlterColumn<int>(
                name: "TerritoryId",
                table: "Events",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            // Refresh tokens now live in UserSessions, and stock in InventoryStocks.
            migrationBuilder.DropColumn(
                name: "RefreshToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RefreshTokenExpiry",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "QuantityOnHand",
                table: "ProductVariants");

            migrationBuilder.CreateIndex(
                name: "IX_Users_TerritoryId",
                table: "Users",
                column: "TerritoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_TerritoryId",
                table: "Products",
                column: "TerritoryId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_TerritoryId_ProductVariantId",
                table: "InventoryAdjustments",
                columns: new[] { "TerritoryId", "ProductVariantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Events_TerritoryId_IsActive",
                table: "Events",
                columns: new[] { "TerritoryId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryOptions_TerritoryId",
                table: "DeliveryOptions",
                column: "TerritoryId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryStocks_ProductVariantId",
                table: "InventoryStocks",
                column: "ProductVariantId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryStocks_TerritoryId_ProductVariantId",
                table: "InventoryStocks",
                columns: new[] { "TerritoryId", "ProductVariantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Territories_Name",
                table: "Territories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TerritorySettings_TerritoryId_Key",
                table: "TerritorySettings",
                columns: new[] { "TerritoryId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSessions_TokenHash",
                table: "UserSessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSessions_UserId",
                table: "UserSessions",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryOptions_Territories_TerritoryId",
                table: "DeliveryOptions",
                column: "TerritoryId",
                principalTable: "Territories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Territories_TerritoryId",
                table: "Events",
                column: "TerritoryId",
                principalTable: "Territories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Territories_TerritoryId",
                table: "Products",
                column: "TerritoryId",
                principalTable: "Territories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Territories_TerritoryId",
                table: "Users",
                column: "TerritoryId",
                principalTable: "Territories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryOptions_Territories_TerritoryId",
                table: "DeliveryOptions");

            migrationBuilder.DropForeignKey(
                name: "FK_Events_Territories_TerritoryId",
                table: "Events");

            migrationBuilder.DropForeignKey(
                name: "FK_Products_Territories_TerritoryId",
                table: "Products");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Territories_TerritoryId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "InventoryStocks");

            migrationBuilder.DropTable(
                name: "TerritorySettings");

            migrationBuilder.DropTable(
                name: "UserSessions");

            migrationBuilder.DropTable(
                name: "Territories");

            migrationBuilder.DropIndex(
                name: "IX_Users_TerritoryId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Products_TerritoryId",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_TerritoryId_ProductVariantId",
                table: "InventoryAdjustments");

            migrationBuilder.DropIndex(
                name: "IX_Events_TerritoryId_IsActive",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryOptions_TerritoryId",
                table: "DeliveryOptions");

            migrationBuilder.DropColumn(
                name: "FailedLoginCount",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LockoutUntil",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TerritoryId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TerritoryId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "TerritoryId",
                table: "InventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "TerritoryId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "TerritoryId",
                table: "DeliveryOptions");

            migrationBuilder.DropColumn(
                name: "PasswordChangedAt",
                table: "Users");

            migrationBuilder.AddColumn<DateTime>(
                name: "RefreshTokenExpiry",
                table: "Users",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefreshToken",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuantityOnHand",
                table: "ProductVariants",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
