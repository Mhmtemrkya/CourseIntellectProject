using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentRecommendations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "student_recommendations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Subject = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Topic = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Diagnosis = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    SuggestedQuestions = table.Column<int>(type: "integer", nullable: false),
                    BaselineSuccessRate = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: false),
                    BaselineSolved = table.Column<int>(type: "integer", nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_recommendations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_recommendations_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_student_recommendations_branch_id",
                table: "student_recommendations",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_recommendations_StudentUserId_IssuedAtUtc",
                table: "student_recommendations",
                columns: new[] { "StudentUserId", "IssuedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_student_recommendations_tenant_id",
                table: "student_recommendations",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "student_recommendations");
        }
    }
}
