using System;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(CourseIntellectDbContext))]
    [Migration("20260622120000_AddAdminTaskAcceptanceFlow")]
    public partial class AddAdminTaskAcceptanceFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "StartDateUtc",
                table: "admin_tasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDateUtc",
                table: "admin_tasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponseStatus",
                table: "admin_tasks",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "admin_tasks",
                type: "character varying(1200)",
                maxLength: 1200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RespondedAtUtc",
                table: "admin_tasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_admin_tasks_tenant_id_AssignedToUserId",
                table: "admin_tasks",
                columns: new[] { "tenant_id", "AssignedToUserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_admin_tasks_tenant_id_AssignedToUserId",
                table: "admin_tasks");

            migrationBuilder.DropColumn(
                name: "StartDateUtc",
                table: "admin_tasks");

            migrationBuilder.DropColumn(
                name: "EndDateUtc",
                table: "admin_tasks");

            migrationBuilder.DropColumn(
                name: "ResponseStatus",
                table: "admin_tasks");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "admin_tasks");

            migrationBuilder.DropColumn(
                name: "RespondedAtUtc",
                table: "admin_tasks");
        }
    }
}
