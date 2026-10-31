using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVisitors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "visitor_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IdentityLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    VisitorType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Purpose = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    HostUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    HostName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    BadgeNo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    VehiclePlate = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CompanionCount = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    PrivacyNoticeShown = table.Column<bool>(type: "boolean", nullable: false),
                    CheckInAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CheckOutAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CheckedOutByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_visitor_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_visitor_entries_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_visitor_entries_branch_id",
                table: "visitor_entries",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_visitor_entries_CheckOutAtUtc",
                table: "visitor_entries",
                column: "CheckOutAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_visitor_entries_tenant_id",
                table: "visitor_entries",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_visitor_entries_tenant_id_CheckInAtUtc",
                table: "visitor_entries",
                columns: new[] { "tenant_id", "CheckInAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "visitor_entries");
        }
    }
}
