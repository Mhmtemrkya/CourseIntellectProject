using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAssistantFeedbackAndPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "Feedback",
                table: "assistant_messages",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Portal",
                table: "assistant_conversations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Feedback",
                table: "assistant_messages");

            migrationBuilder.DropColumn(
                name: "Portal",
                table: "assistant_conversations");
        }
    }
}
