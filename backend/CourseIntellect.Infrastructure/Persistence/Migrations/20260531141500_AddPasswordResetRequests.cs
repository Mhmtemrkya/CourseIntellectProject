using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using System;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260531141500_AddPasswordResetRequests")]
public partial class AddPasswordResetRequests : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "password_reset_requests",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                requested_email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                full_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                primary_role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                review_note = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                reviewed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                reviewed_by_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                requested_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                reviewed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                temporary_password_created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                used_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_password_reset_requests", x => x.id);
                table.ForeignKey(
                    name: "FK_password_reset_requests_tenant_workspaces_tenant_id",
                    column: x => x.tenant_id,
                    principalTable: "tenant_workspaces",
                    principalColumn: "id",
                    onDelete: ReferentialAction.SetNull);
                table.ForeignKey(
                    name: "FK_password_reset_requests_users_reviewed_by_user_id",
                    column: x => x.reviewed_by_user_id,
                    principalTable: "users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
                table.ForeignKey(
                    name: "FK_password_reset_requests_users_user_id",
                    column: x => x.user_id,
                    principalTable: "users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_password_reset_requests_reviewed_by_user_id",
            table: "password_reset_requests",
            column: "reviewed_by_user_id");

        migrationBuilder.CreateIndex(
            name: "IX_password_reset_requests_tenant_id",
            table: "password_reset_requests",
            column: "tenant_id");

        migrationBuilder.CreateIndex(
            name: "IX_password_reset_requests_tenant_id_requested_email",
            table: "password_reset_requests",
            columns: new[] { "tenant_id", "requested_email" });

        migrationBuilder.CreateIndex(
            name: "IX_password_reset_requests_tenant_id_status_requested_at_utc",
            table: "password_reset_requests",
            columns: new[] { "tenant_id", "status", "requested_at_utc" });

        migrationBuilder.CreateIndex(
            name: "IX_password_reset_requests_user_id_status",
            table: "password_reset_requests",
            columns: new[] { "user_id", "status" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "password_reset_requests");
    }
}
