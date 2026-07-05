using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGuidanceModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "guidance_appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    CounselorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    RequesterName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    RequesterRole = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Slot = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Topic = table.Column<string>(type: "text", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DecisionNote = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guidance_appointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_guidance_appointments_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "guidance_availability_slots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    CounselorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Slot = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guidance_availability_slots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_guidance_availability_slots_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "guidance_goals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CounselorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TargetSchool = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TargetField = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TargetScore = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Progress = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guidance_goals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_guidance_goals_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "guidance_inventories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    CounselorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    InventoryType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AnswersJson = table.Column<string>(type: "text", nullable: false),
                    AssignedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guidance_inventories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_guidance_inventories_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "guidance_risk_reviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    CounselorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    RiskLevel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guidance_risk_reviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_guidance_risk_reviews_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "guidance_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    CounselorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SessionType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Topic = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    Visibility = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SessionAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FollowUpAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FollowUpDone = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guidance_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_guidance_sessions_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_guidance_appointments_CounselorName",
                table: "guidance_appointments",
                column: "CounselorName");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_appointments_tenant_id",
                table: "guidance_appointments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_availability_slots_CounselorName",
                table: "guidance_availability_slots",
                column: "CounselorName");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_availability_slots_tenant_id",
                table: "guidance_availability_slots",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_goals_StudentName",
                table: "guidance_goals",
                column: "StudentName");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_goals_tenant_id",
                table: "guidance_goals",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_inventories_StudentName",
                table: "guidance_inventories",
                column: "StudentName");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_inventories_tenant_id",
                table: "guidance_inventories",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_risk_reviews_StudentName",
                table: "guidance_risk_reviews",
                column: "StudentName");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_risk_reviews_tenant_id",
                table: "guidance_risk_reviews",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_sessions_CounselorName",
                table: "guidance_sessions",
                column: "CounselorName");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_sessions_StudentName",
                table: "guidance_sessions",
                column: "StudentName");

            migrationBuilder.CreateIndex(
                name: "IX_guidance_sessions_tenant_id",
                table: "guidance_sessions",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "guidance_appointments");

            migrationBuilder.DropTable(
                name: "guidance_availability_slots");

            migrationBuilder.DropTable(
                name: "guidance_goals");

            migrationBuilder.DropTable(
                name: "guidance_inventories");

            migrationBuilder.DropTable(
                name: "guidance_risk_reviews");

            migrationBuilder.DropTable(
                name: "guidance_sessions");
        }
    }
}
