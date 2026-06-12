using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    public partial class AddPushDeviceRegistrations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "push_device_registrations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    platform = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    username = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    full_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    role = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    device_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_seen_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_push_device_registrations", x => x.id);
                    table.ForeignKey(
                        name: "FK_push_device_registrations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_push_device_registrations_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_push_device_registrations_tenant_id",
                table: "push_device_registrations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_push_device_registrations_tenant_id_user_id_is_active",
                table: "push_device_registrations",
                columns: new[] { "tenant_id", "user_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_push_device_registrations_token",
                table: "push_device_registrations",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_push_device_registrations_user_id",
                table: "push_device_registrations",
                column: "user_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "push_device_registrations");
        }
    }
}
