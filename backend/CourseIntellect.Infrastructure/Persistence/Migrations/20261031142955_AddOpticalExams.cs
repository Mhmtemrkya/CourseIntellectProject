using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOpticalExams : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "optical_exam_answers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    OpticalExamId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Booklet = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    Subject = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    QuestionNo = table.Column<int>(type: "integer", nullable: false),
                    Topic = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Outcome = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Marked = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_optical_exam_answers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_optical_exam_answers_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "optical_exam_student_results",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    OpticalExamId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Booklet = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    Subject = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Correct = table.Column<int>(type: "integer", nullable: false),
                    Wrong = table.Column<int>(type: "integer", nullable: false),
                    Blank = table.Column<int>(type: "integer", nullable: false),
                    Net = table.Column<decimal>(type: "numeric(9,2)", precision: 9, scale: 2, nullable: false),
                    ExamResultId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_optical_exam_student_results", x => x.Id);
                    table.ForeignKey(
                        name: "FK_optical_exam_student_results_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "optical_exams",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ExamDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WrongPenalty = table.Column<int>(type: "integer", nullable: false),
                    MultiMarkAsWrong = table.Column<bool>(type: "boolean", nullable: false),
                    CancelledMode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    KeysJson = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ImportedStudentCount = table.Column<int>(type: "integer", nullable: false),
                    ImportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ImportedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_optical_exams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_optical_exams_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "optical_templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Encoding = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StudentNoStart = table.Column<int>(type: "integer", nullable: false),
                    StudentNoLength = table.Column<int>(type: "integer", nullable: false),
                    NameStart = table.Column<int>(type: "integer", nullable: false),
                    NameLength = table.Column<int>(type: "integer", nullable: false),
                    ClassStart = table.Column<int>(type: "integer", nullable: false),
                    ClassLength = table.Column<int>(type: "integer", nullable: false),
                    BookletStart = table.Column<int>(type: "integer", nullable: false),
                    BookletLength = table.Column<int>(type: "integer", nullable: false),
                    SubjectsJson = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_optical_templates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_optical_templates_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_optical_exam_answers_branch_id",
                table: "optical_exam_answers",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_optical_exam_answers_OpticalExamId_StudentUserId",
                table: "optical_exam_answers",
                columns: new[] { "OpticalExamId", "StudentUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_optical_exam_answers_StudentUserId",
                table: "optical_exam_answers",
                column: "StudentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_optical_exam_answers_tenant_id",
                table: "optical_exam_answers",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_optical_exam_student_results_branch_id",
                table: "optical_exam_student_results",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_optical_exam_student_results_OpticalExamId_StudentUserId",
                table: "optical_exam_student_results",
                columns: new[] { "OpticalExamId", "StudentUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_optical_exam_student_results_tenant_id",
                table: "optical_exam_student_results",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_optical_exams_branch_id",
                table: "optical_exams",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_optical_exams_ExamDateUtc",
                table: "optical_exams",
                column: "ExamDateUtc");

            migrationBuilder.CreateIndex(
                name: "IX_optical_exams_tenant_id",
                table: "optical_exams",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_optical_templates_tenant_id",
                table: "optical_templates",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "optical_exam_answers");

            migrationBuilder.DropTable(
                name: "optical_exam_student_results");

            migrationBuilder.DropTable(
                name: "optical_exams");

            migrationBuilder.DropTable(
                name: "optical_templates");
        }
    }
}
