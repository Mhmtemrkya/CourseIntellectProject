using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantGroupsAndUserScopeGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "group_id",
                table: "tenant_workspaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "tenant_groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    slug = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_scope_grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    target_id = table.Column<Guid>(type: "uuid", nullable: true),
                    access_mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    is_home = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_scope_grants", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_scope_grants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tenant_workspaces_group_id",
                table: "tenant_workspaces",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_groups_owner_user_id",
                table: "tenant_groups",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_groups_slug",
                table: "tenant_groups",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_scope_grants_user_id_level",
                table: "user_scope_grants",
                columns: new[] { "user_id", "level" });

            migrationBuilder.CreateIndex(
                name: "IX_user_scope_grants_user_id_target_id",
                table: "user_scope_grants",
                columns: new[] { "user_id", "target_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_tenant_workspaces_tenant_groups_group_id",
                table: "tenant_workspaces",
                column: "group_id",
                principalTable: "tenant_groups",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tenant_workspaces_tenant_groups_group_id",
                table: "tenant_workspaces");

            migrationBuilder.DropTable(
                name: "tenant_groups");

            migrationBuilder.DropTable(
                name: "user_scope_grants");

            migrationBuilder.DropIndex(
                name: "IX_tenant_workspaces_group_id",
                table: "tenant_workspaces");

            migrationBuilder.DropColumn(
                name: "group_id",
                table: "tenant_workspaces");
        }
    }
}
