using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationsAndRolePolicies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "role_history",
                table: "users",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Message = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    TimeLabel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Audience = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TargetRole = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "role_policies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LoginEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresCriticalApproval = table.Column<bool>(type: "boolean", nullable: false),
                    MessagingScope = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    module_access = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_policies", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_role_policies_RoleName",
                table: "role_policies",
                column: "RoleName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "role_policies");

            migrationBuilder.DropColumn(
                name: "role_history",
                table: "users");
        }
    }
}
