using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWebModules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Value = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "attendance_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LessonDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Lesson = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "contact_messages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Subject = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsStarred = table.Column<bool>(type: "boolean", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReadAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RepliedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contact_messages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "course_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Duration = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Level = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_course_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "homework_assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    ClassName = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Subject = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Teacher = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DeadlineLabel = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    materials = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    TotalStudents = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_homework_assignments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "homework_submissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Note = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    files = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SubmittedAtLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_homework_submissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "login_attempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Success = table.Column<bool>(type: "boolean", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_login_attempts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "platform_configurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConfigurationType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ScopeKey = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    payload_json = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_configurations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "question_practice_attempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentUsername = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    AnswerText = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_question_practice_attempts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "site_content_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SectionKey = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ContentJson = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: false),
                    Language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_site_content_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "study_plan_states",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    plan_items = table.Column<string>(type: "character varying(12000)", maxLength: 12000, nullable: false),
                    StreakCount = table.Column<int>(type: "integer", nullable: false),
                    XpPoints = table.Column<int>(type: "integer", nullable: false),
                    LastCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_study_plan_states", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "support_tickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TicketNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Subject = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    TenantName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    RequestedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    RequestedRole = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    LastMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    MessageCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_support_tickets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_workspaces",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Slug = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    ContactEmail = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Plan = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    UserCount = table.Column<int>(type: "integer", nullable: false),
                    BranchCount = table.Column<int>(type: "integer", nullable: false),
                    StudentCount = table.Column<int>(type: "integer", nullable: false),
                    StaffCount = table.Column<int>(type: "integer", nullable: false),
                    MonthlyFee = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CollectedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    StorageUsedGb = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ApiUsage = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_workspaces", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "translation_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Value = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_translation_items", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_Key",
                table: "app_settings",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_attendance_entries_ClassName",
                table: "attendance_entries",
                column: "ClassName");

            migrationBuilder.CreateIndex(
                name: "IX_contact_messages_Status",
                table: "contact_messages",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_course_items_Category",
                table: "course_items",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_homework_submissions_AssignmentId",
                table: "homework_submissions",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_login_attempts_Email",
                table: "login_attempts",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_login_attempts_Timestamp",
                table: "login_attempts",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_platform_configurations_ConfigurationType_ScopeKey",
                table: "platform_configurations",
                columns: new[] { "ConfigurationType", "ScopeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_question_practice_attempts_QuestionId_StudentUsername",
                table: "question_practice_attempts",
                columns: new[] { "QuestionId", "StudentUsername" });

            migrationBuilder.CreateIndex(
                name: "IX_site_content_items_SectionKey_Language_Version",
                table: "site_content_items",
                columns: new[] { "SectionKey", "Language", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_study_plan_states_StudentName",
                table: "study_plan_states",
                column: "StudentName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_support_tickets_TicketNumber",
                table: "support_tickets",
                column: "TicketNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_workspaces_Slug",
                table: "tenant_workspaces",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_translation_items_Key_Language",
                table: "translation_items",
                columns: new[] { "Key", "Language" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_settings");

            migrationBuilder.DropTable(
                name: "attendance_entries");

            migrationBuilder.DropTable(
                name: "contact_messages");

            migrationBuilder.DropTable(
                name: "course_items");

            migrationBuilder.DropTable(
                name: "homework_assignments");

            migrationBuilder.DropTable(
                name: "homework_submissions");

            migrationBuilder.DropTable(
                name: "login_attempts");

            migrationBuilder.DropTable(
                name: "platform_configurations");

            migrationBuilder.DropTable(
                name: "question_practice_attempts");

            migrationBuilder.DropTable(
                name: "site_content_items");

            migrationBuilder.DropTable(
                name: "study_plan_states");

            migrationBuilder.DropTable(
                name: "support_tickets");

            migrationBuilder.DropTable(
                name: "tenant_workspaces");

            migrationBuilder.DropTable(
                name: "translation_items");
        }
    }
}
