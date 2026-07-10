using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantGroupHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "parent_group_id",
                table: "tenant_groups",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_groups_parent_group_id",
                table: "tenant_groups",
                column: "parent_group_id");

            migrationBuilder.AddForeignKey(
                name: "FK_tenant_groups_tenant_groups_parent_group_id",
                table: "tenant_groups",
                column: "parent_group_id",
                principalTable: "tenant_groups",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tenant_groups_tenant_groups_parent_group_id",
                table: "tenant_groups");

            migrationBuilder.DropIndex(
                name: "IX_tenant_groups_parent_group_id",
                table: "tenant_groups");

            migrationBuilder.DropColumn(
                name: "parent_group_id",
                table: "tenant_groups");
        }
    }
}
