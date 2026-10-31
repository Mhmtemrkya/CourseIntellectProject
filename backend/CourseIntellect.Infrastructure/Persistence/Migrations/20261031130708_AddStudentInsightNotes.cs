using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentInsightNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "student_insight_notes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InputHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Draft = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Error = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GeneratedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewStatus = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ReviewedText = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_insight_notes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_insight_notes_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_student_insight_notes_branch_id",
                table: "student_insight_notes",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_insight_notes_ReviewStatus",
                table: "student_insight_notes",
                column: "ReviewStatus");

            migrationBuilder.CreateIndex(
                name: "IX_student_insight_notes_StudentUserId_RequestedAtUtc",
                table: "student_insight_notes",
                columns: new[] { "StudentUserId", "RequestedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_student_insight_notes_tenant_id",
                table: "student_insight_notes",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "student_insight_notes");
        }
    }
}
