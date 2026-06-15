using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(CourseIntellectDbContext))]
    [Migration("20260603100000_ExpandSiteContentPayload")]
    public partial class ExpandSiteContentPayload : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ContentJson",
                table: "site_content_items",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(12000)",
                oldMaxLength: 12000);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ContentJson",
                table: "site_content_items",
                type: "character varying(12000)",
                maxLength: 12000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
