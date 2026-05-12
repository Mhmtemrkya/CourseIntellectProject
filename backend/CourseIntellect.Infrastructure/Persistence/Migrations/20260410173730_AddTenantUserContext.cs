using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantUserContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AdminUserId",
                table: "tenant_workspaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAtUtc",
                table: "tenant_workspaces",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactName",
                table: "tenant_workspaces",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContactPhone",
                table: "tenant_workspaces",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_tenant_id",
                table: "users",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_workspaces_AdminUserId",
                table: "tenant_workspaces",
                column: "AdminUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_tenant_workspaces_users_AdminUserId",
                table: "tenant_workspaces",
                column: "AdminUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_users_tenant_workspaces_tenant_id",
                table: "users",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tenant_workspaces_users_AdminUserId",
                table: "tenant_workspaces");

            migrationBuilder.DropForeignKey(
                name: "FK_users_tenant_workspaces_tenant_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_tenant_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_tenant_workspaces_AdminUserId",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AdminUserId",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "ApprovedAtUtc",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "ContactName",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "ContactPhone",
                table: "tenant_workspaces");
        }
    }
}
