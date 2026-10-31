using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExamBlankAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "exam_blank_answers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentUsername = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ExamSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_blank_answers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_exam_blank_answers_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_exam_blank_answers_ExamSessionId_QuestionId",
                table: "exam_blank_answers",
                columns: new[] { "ExamSessionId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_exam_blank_answers_StudentUsername",
                table: "exam_blank_answers",
                column: "StudentUsername");

            migrationBuilder.CreateIndex(
                name: "IX_exam_blank_answers_tenant_id",
                table: "exam_blank_answers",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "exam_blank_answers");
        }
    }
}
