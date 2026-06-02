using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContentEngagementFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowDownload",
                table: "content_items",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowNotes",
                table: "content_items",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "CompletionCertificate",
                table: "content_items",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CoverImageUrl",
                table: "content_items",
                type: "character varying(600)",
                maxLength: 600,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaylistKey",
                table: "content_items",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PlaylistOrder",
                table: "content_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaylistTitle",
                table: "content_items",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowDownload",
                table: "content_items");

            migrationBuilder.DropColumn(
                name: "AllowNotes",
                table: "content_items");

            migrationBuilder.DropColumn(
                name: "CompletionCertificate",
                table: "content_items");

            migrationBuilder.DropColumn(
                name: "CoverImageUrl",
                table: "content_items");

            migrationBuilder.DropColumn(
                name: "PlaylistKey",
                table: "content_items");

            migrationBuilder.DropColumn(
                name: "PlaylistOrder",
                table: "content_items");

            migrationBuilder.DropColumn(
                name: "PlaylistTitle",
                table: "content_items");
        }
    }
}
