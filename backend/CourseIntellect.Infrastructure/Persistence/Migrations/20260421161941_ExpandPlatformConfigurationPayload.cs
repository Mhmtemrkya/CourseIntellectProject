using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpandPlatformConfigurationPayload : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "payload_json",
                table: "platform_configurations",
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
                name: "payload_json",
                table: "platform_configurations",
                type: "character varying(12000)",
                maxLength: 12000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
