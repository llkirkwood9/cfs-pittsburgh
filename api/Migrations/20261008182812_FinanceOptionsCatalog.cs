using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class FinanceOptionsCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FinanceOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinanceOptions", x => x.Id);
                });

            // The finance options used to be a list under Settings. Carry any saved list over, in
            // its order, then drop the old setting.
            migrationBuilder.Sql(@"
                INSERT INTO ""FinanceOptions"" (""Name"", ""SortOrder"", ""IsActive"")
                SELECT left(trim(o.value), 100), o.ordinality, TRUE
                FROM ""AppSettings"" s
                CROSS JOIN LATERAL json_array_elements_text(s.""Value""::json) WITH ORDINALITY AS o(value, ordinality)
                WHERE s.""Key"" = 'FinanceOptions' AND json_typeof(s.""Value""::json) = 'array' AND trim(o.value) <> '';
                DELETE FROM ""AppSettings"" WHERE ""Key"" = 'FinanceOptions';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FinanceOptions");
        }
    }
}
