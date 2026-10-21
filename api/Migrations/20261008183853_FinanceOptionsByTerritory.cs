using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class FinanceOptionsByTerritory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TerritoryId",
                table: "FinanceOptions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FinanceOptions_TerritoryId",
                table: "FinanceOptions",
                column: "TerritoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_FinanceOptions_Territories_TerritoryId",
                table: "FinanceOptions",
                column: "TerritoryId",
                principalTable: "Territories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // A territory could keep its own finance list under Settings. Carry each one over as
            // that territory's own options, leaving out any name already offered globally, then
            // drop the old setting.
            migrationBuilder.Sql(@"
                INSERT INTO ""FinanceOptions"" (""Name"", ""SortOrder"", ""IsActive"", ""TerritoryId"")
                SELECT DISTINCT ON (s.""TerritoryId"", lower(trim(o.value)))
                       left(trim(o.value), 100), o.ordinality, TRUE, s.""TerritoryId""
                FROM ""TerritorySettings"" s
                CROSS JOIN LATERAL json_array_elements_text(s.""Value""::json) WITH ORDINALITY AS o(value, ordinality)
                WHERE s.""Key"" = 'FinanceOptions' AND json_typeof(s.""Value""::json) = 'array' AND trim(o.value) <> ''
                  AND NOT EXISTS (SELECT 1 FROM ""FinanceOptions"" g
                                  WHERE g.""TerritoryId"" IS NULL AND lower(g.""Name"") = lower(trim(o.value)));
                DELETE FROM ""TerritorySettings"" WHERE ""Key"" = 'FinanceOptions';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FinanceOptions_Territories_TerritoryId",
                table: "FinanceOptions");

            migrationBuilder.DropIndex(
                name: "IX_FinanceOptions_TerritoryId",
                table: "FinanceOptions");

            migrationBuilder.DropColumn(
                name: "TerritoryId",
                table: "FinanceOptions");
        }
    }
}
