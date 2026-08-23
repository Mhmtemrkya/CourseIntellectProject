using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantRegistrationMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "kvkk_consent_at_utc",
                table: "tenant_workspaces",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kvkk_consent_version",
                table: "tenant_workspaces",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "registration_estimated_students",
                table: "tenant_workspaces",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "registration_ip",
                table: "tenant_workspaces",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "registration_referer",
                table: "tenant_workspaces",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "registration_user_agent",
                table: "tenant_workspaces",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_workspaces_status_created_at_utc",
                table: "tenant_workspaces",
                columns: new[] { "status", "created_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tenant_workspaces_status_created_at_utc",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "kvkk_consent_at_utc",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "kvkk_consent_version",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "registration_estimated_students",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "registration_ip",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "registration_referer",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "registration_user_agent",
                table: "tenant_workspaces");
        }
    }
}
