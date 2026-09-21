using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveEventSchoolName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Keep the school in the event's name: "Hampton" + "Band" becomes "Hampton Band". An
            // organization that already starts with the school name is left as it is.
            migrationBuilder.Sql(@"
UPDATE Events
SET Organization = LTRIM(RTRIM(
    CASE
        WHEN LTRIM(RTRIM(SchoolName)) = '' THEN Organization
        WHEN LTRIM(RTRIM(Organization)) = '' THEN SchoolName
        WHEN Organization LIKE SchoolName + '%' THEN Organization
        ELSE LEFT(SchoolName + ' ' + Organization, 150)
    END));
");

            migrationBuilder.DropColumn(
                name: "SchoolName",
                table: "Events");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SchoolName",
                table: "Events",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");
        }
    }
}
