using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffHrModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "staff_asset_assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    AssetName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AssetCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    AssignedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReturnedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_asset_assignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_staff_asset_assignments_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "staff_leave_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    LeaveType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    StartDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Days = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ApprovalRequestId = table.Column<Guid>(type: "uuid", nullable: true),
                    DecidedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DecidedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_leave_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_staff_leave_requests_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_staff_asset_assignments_StaffUserId",
                table: "staff_asset_assignments",
                column: "StaffUserId");

            migrationBuilder.CreateIndex(
                name: "IX_staff_asset_assignments_tenant_id",
                table: "staff_asset_assignments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_leave_requests_StaffUserId",
                table: "staff_leave_requests",
                column: "StaffUserId");

            migrationBuilder.CreateIndex(
                name: "IX_staff_leave_requests_tenant_id",
                table: "staff_leave_requests",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_leave_requests_tenant_id_Status",
                table: "staff_leave_requests",
                columns: new[] { "tenant_id", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "staff_asset_assignments");

            migrationBuilder.DropTable(
                name: "staff_leave_requests");
        }
    }
}
