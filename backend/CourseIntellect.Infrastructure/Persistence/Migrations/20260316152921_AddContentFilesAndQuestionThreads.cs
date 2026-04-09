using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddContentFilesAndQuestionThreads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImagePlacement",
                table: "question_bank_items",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FileUrl",
                table: "content_items",
                type: "character varying(600)",
                maxLength: 600,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "student_question_replies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThreadId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SenderRole = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MessageText = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAtLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    attachments = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_question_replies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "student_question_threads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Subject = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentUsername = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TeacherName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    QuestionText = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAtLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    LastActivityLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AttachmentSummary = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    attachments = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_question_threads", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_student_question_replies_ThreadId",
                table: "student_question_replies",
                column: "ThreadId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "student_question_replies");

            migrationBuilder.DropTable(
                name: "student_question_threads");

            migrationBuilder.DropColumn(
                name: "ImagePlacement",
                table: "question_bank_items");

            migrationBuilder.DropColumn(
                name: "FileUrl",
                table: "content_items");
        }
    }
}
