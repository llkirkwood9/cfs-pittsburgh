using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class SplitNameAndLateOrderNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "OrderNumber",
                table: "Orders",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "BillingFirstName",
                table: "Orders",
                type: "character varying(75)",
                maxLength: 75,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillingLastName",
                table: "Orders",
                type: "character varying(75)",
                maxLength: 75,
                nullable: true);

            // Existing names split at the first space: "Mary Ann Smith" is "Mary" and "Ann Smith".
            migrationBuilder.Sql(@"
                UPDATE ""Orders""
                SET ""BillingFirstName"" = NULLIF(split_part(btrim(""BillingName""), ' ', 1), ''),
                    ""BillingLastName"" = NULLIF(btrim(substr(btrim(""BillingName""), length(split_part(btrim(""BillingName""), ' ', 1)) + 1)), '')
                WHERE ""BillingName"" IS NOT NULL AND btrim(""BillingName"") <> '';");

            // Drafts with nothing on them yet give up their numbers, as new ones never get one.
            migrationBuilder.Sql(@"
                UPDATE ""Orders"" o
                SET ""OrderNumber"" = NULL
                WHERE o.""Status"" = 0
                  AND NOT EXISTS (SELECT 1 FROM ""OrderLines"" l WHERE l.""OrderId"" = o.""Id"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Unnumbered drafts need a number again; a negative one can't clash with a real one.
            migrationBuilder.Sql(@"UPDATE ""Orders"" SET ""OrderNumber"" = -""Id"" WHERE ""OrderNumber"" IS NULL;");

            migrationBuilder.DropColumn(
                name: "BillingFirstName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BillingLastName",
                table: "Orders");

            migrationBuilder.AlterColumn<int>(
                name: "OrderNumber",
                table: "Orders",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
