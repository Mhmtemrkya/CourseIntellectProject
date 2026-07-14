using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingPermissionsAndAuditContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "permissions",
                table: "custom_roles",
                type: "character varying(8000)",
                maxLength: 8000,
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "after_value",
                table: "audit_log_entries",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "before_value",
                table: "audit_log_entries",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ip_address",
                table: "audit_log_entries",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "user_agent",
                table: "audit_log_entries",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_entries_tenant_id_Category_CreatedAtUtc",
                table: "audit_log_entries",
                columns: new[] { "tenant_id", "Category", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_audit_log_entries_tenant_id_Category_CreatedAtUtc",
                table: "audit_log_entries");

            migrationBuilder.DropColumn(
                name: "permissions",
                table: "custom_roles");

            migrationBuilder.DropColumn(
                name: "after_value",
                table: "audit_log_entries");

            migrationBuilder.DropColumn(
                name: "before_value",
                table: "audit_log_entries");

            migrationBuilder.DropColumn(
                name: "ip_address",
                table: "audit_log_entries");

            migrationBuilder.DropColumn(
                name: "user_agent",
                table: "audit_log_entries");
        }
    }
}
