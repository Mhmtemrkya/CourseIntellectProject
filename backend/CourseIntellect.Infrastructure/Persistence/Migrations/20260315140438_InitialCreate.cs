using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "announcements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Detail = table.Column<string>(type: "text", nullable: false),
                    Audience = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DateLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_announcements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "content_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Subject = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Teacher = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Info = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Progress = table.Column<double>(type: "double precision", nullable: false),
                    FileType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Grade = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Views = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Size = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PublishStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_content_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "exam_results",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExamTitle = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Subject = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DateLabel = table.Column<string>(type: "text", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    Net = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_results", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meeting_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Advisor = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Slot = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    OnlineMeeting = table.Column<bool>(type: "boolean", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meeting_requests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "message_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThreadId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SenderRole = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "message_threads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantOneName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ParticipantOneRole = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ParticipantTwoName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ParticipantTwoRole = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LastMessagePreview = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    LastMessageAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_threads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "question_bank_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Subject = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Topic = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Difficulty = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    QuestionText = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Teacher = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAtLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    UsageCount = table.Column<int>(type: "integer", nullable: false),
                    ImagePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    options = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CorrectOptionIndex = table.Column<int>(type: "integer", nullable: true),
                    class_targets = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    SolutionAssetPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SolutionAssetType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    RevealCorrectAnswerToStudent = table.Column<bool>(type: "boolean", nullable: false),
                    ExpectedAnswer = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_question_bank_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refresh_token_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_token_sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "staff_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TcNo = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Education = table.Column<string>(type: "text", nullable: false),
                    StartDate = table.Column<string>(type: "text", nullable: false),
                    Campus = table.Column<string>(type: "text", nullable: false),
                    DepartmentOrBranch = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    HomeroomClass = table.Column<string>(type: "text", nullable: false),
                    MaritalStatus = table.Column<string>(type: "text", nullable: false),
                    ChildCount = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    assigned_classes = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_profiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "student_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TcNo = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CurrentSchool = table.Column<string>(type: "text", nullable: false),
                    SchoolNumber = table.Column<string>(type: "text", nullable: false),
                    BirthDate = table.Column<string>(type: "text", nullable: false),
                    ProgramType = table.Column<string>(type: "text", nullable: false),
                    ParentName = table.Column<string>(type: "text", nullable: false),
                    ParentPhone = table.Column<string>(type: "text", nullable: false),
                    ParentEmail = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Address = table.Column<string>(type: "text", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_profiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    PrimaryRole = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Campus = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DepartmentOrBranch = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    extra_roles = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_message_items_ThreadId",
                table: "message_items",
                column: "ThreadId");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_token_sessions_TokenHash",
                table: "refresh_token_sessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_profiles_UserId",
                table: "staff_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_student_profiles_UserId",
                table: "student_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                table: "users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "announcements");

            migrationBuilder.DropTable(
                name: "content_items");

            migrationBuilder.DropTable(
                name: "exam_results");

            migrationBuilder.DropTable(
                name: "meeting_requests");

            migrationBuilder.DropTable(
                name: "message_items");

            migrationBuilder.DropTable(
                name: "message_threads");

            migrationBuilder.DropTable(
                name: "question_bank_items");

            migrationBuilder.DropTable(
                name: "refresh_token_sessions");

            migrationBuilder.DropTable(
                name: "staff_profiles");

            migrationBuilder.DropTable(
                name: "student_profiles");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
