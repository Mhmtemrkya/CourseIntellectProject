using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomRolesAndUnitManager : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "custom_role_id",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "manager_user_id",
                table: "org_units",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "custom_roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    base_role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    modules = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_custom_roles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_custom_roles_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_users_custom_role_id",
                table: "users",
                column: "custom_role_id");

            migrationBuilder.CreateIndex(
                name: "IX_org_units_manager_user_id",
                table: "org_units",
                column: "manager_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_custom_roles_tenant_id",
                table: "custom_roles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_custom_roles_tenant_id_name",
                table: "custom_roles",
                columns: new[] { "tenant_id", "name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_org_units_users_manager_user_id",
                table: "org_units",
                column: "manager_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_users_custom_roles_custom_role_id",
                table: "users",
                column: "custom_role_id",
                principalTable: "custom_roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_org_units_users_manager_user_id",
                table: "org_units");

            migrationBuilder.DropForeignKey(
                name: "FK_users_custom_roles_custom_role_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "custom_roles");

            migrationBuilder.DropIndex(
                name: "IX_users_custom_role_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_org_units_manager_user_id",
                table: "org_units");

            migrationBuilder.DropColumn(
                name: "custom_role_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "manager_user_id",
                table: "org_units");
        }
    }
}
