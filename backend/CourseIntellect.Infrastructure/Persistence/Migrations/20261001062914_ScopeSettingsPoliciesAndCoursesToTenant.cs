using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeSettingsPoliciesAndCoursesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_role_policies_RoleName",
                table: "role_policies");

            migrationBuilder.DropIndex(
                name: "IX_app_settings_Key",
                table: "app_settings");

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "role_policies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "course_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "app_settings",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_role_policies_RoleName",
                table: "role_policies",
                column: "RoleName",
                unique: true,
                filter: "tenant_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_role_policies_tenant_id",
                table: "role_policies",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_role_policies_tenant_id_RoleName",
                table: "role_policies",
                columns: new[] { "tenant_id", "RoleName" },
                unique: true,
                filter: "tenant_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_course_items_tenant_id",
                table: "course_items",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_Key",
                table: "app_settings",
                column: "Key",
                unique: true,
                filter: "tenant_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_tenant_id",
                table: "app_settings",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_tenant_id_Key",
                table: "app_settings",
                columns: new[] { "tenant_id", "Key" },
                unique: true,
                filter: "tenant_id IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_app_settings_tenant_workspaces_tenant_id",
                table: "app_settings",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_course_items_tenant_workspaces_tenant_id",
                table: "course_items",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_role_policies_tenant_workspaces_tenant_id",
                table: "role_policies",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_app_settings_tenant_workspaces_tenant_id",
                table: "app_settings");

            migrationBuilder.DropForeignKey(
                name: "FK_course_items_tenant_workspaces_tenant_id",
                table: "course_items");

            migrationBuilder.DropForeignKey(
                name: "FK_role_policies_tenant_workspaces_tenant_id",
                table: "role_policies");

            migrationBuilder.DropIndex(
                name: "IX_role_policies_RoleName",
                table: "role_policies");

            migrationBuilder.DropIndex(
                name: "IX_role_policies_tenant_id",
                table: "role_policies");

            migrationBuilder.DropIndex(
                name: "IX_role_policies_tenant_id_RoleName",
                table: "role_policies");

            migrationBuilder.DropIndex(
                name: "IX_course_items_tenant_id",
                table: "course_items");

            migrationBuilder.DropIndex(
                name: "IX_app_settings_Key",
                table: "app_settings");

            migrationBuilder.DropIndex(
                name: "IX_app_settings_tenant_id",
                table: "app_settings");

            migrationBuilder.DropIndex(
                name: "IX_app_settings_tenant_id_Key",
                table: "app_settings");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "role_policies");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "course_items");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "app_settings");

            migrationBuilder.CreateIndex(
                name: "IX_role_policies_RoleName",
                table: "role_policies",
                column: "RoleName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_Key",
                table: "app_settings",
                column: "Key",
                unique: true);
        }
    }
}
