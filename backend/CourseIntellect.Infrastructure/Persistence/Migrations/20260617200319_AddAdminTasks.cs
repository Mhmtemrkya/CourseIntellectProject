using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Category = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    AssignedToUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssignedToName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Priority = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_tasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_admin_tasks_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_tasks_tenant_id",
                table: "admin_tasks",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_admin_tasks_tenant_id_Status",
                table: "admin_tasks",
                columns: new[] { "tenant_id", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_tasks");
        }
    }
}
