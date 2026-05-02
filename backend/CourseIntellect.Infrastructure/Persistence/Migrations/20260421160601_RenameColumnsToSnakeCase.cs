using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameColumnsToSnakeCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Status",
                table: "tenant_workspaces",
                newName: "status");

            migrationBuilder.RenameColumn(
                name: "Slug",
                table: "tenant_workspaces",
                newName: "slug");

            migrationBuilder.RenameColumn(
                name: "Plan",
                table: "tenant_workspaces",
                newName: "plan");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "tenant_workspaces",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "tenant_workspaces",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UserCount",
                table: "tenant_workspaces",
                newName: "user_count");

            migrationBuilder.RenameColumn(
                name: "StudentCount",
                table: "tenant_workspaces",
                newName: "student_count");

            migrationBuilder.RenameColumn(
                name: "StorageUsedGb",
                table: "tenant_workspaces",
                newName: "storage_used_gb");

            migrationBuilder.RenameColumn(
                name: "StaffCount",
                table: "tenant_workspaces",
                newName: "staff_count");

            migrationBuilder.RenameColumn(
                name: "MonthlyFee",
                table: "tenant_workspaces",
                newName: "monthly_fee");

            migrationBuilder.RenameColumn(
                name: "CreatedAtUtc",
                table: "tenant_workspaces",
                newName: "created_at_utc");

            migrationBuilder.RenameColumn(
                name: "ContactEmail",
                table: "tenant_workspaces",
                newName: "contact_email");

            migrationBuilder.RenameColumn(
                name: "CollectedAmount",
                table: "tenant_workspaces",
                newName: "collected_amount");

            migrationBuilder.RenameColumn(
                name: "BranchCount",
                table: "tenant_workspaces",
                newName: "branch_count");

            migrationBuilder.RenameColumn(
                name: "ApiUsage",
                table: "tenant_workspaces",
                newName: "api_usage");

            migrationBuilder.RenameIndex(
                name: "IX_tenant_workspaces_Slug",
                table: "tenant_workspaces",
                newName: "IX_tenant_workspaces_slug");

            migrationBuilder.RenameColumn(
                name: "Summary",
                table: "support_tickets",
                newName: "summary");

            migrationBuilder.RenameColumn(
                name: "Subject",
                table: "support_tickets",
                newName: "subject");

            migrationBuilder.RenameColumn(
                name: "Status",
                table: "support_tickets",
                newName: "status");

            migrationBuilder.RenameColumn(
                name: "Priority",
                table: "support_tickets",
                newName: "priority");

            migrationBuilder.RenameColumn(
                name: "Category",
                table: "support_tickets",
                newName: "category");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "support_tickets",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAtUtc",
                table: "support_tickets",
                newName: "updated_at_utc");

            migrationBuilder.RenameColumn(
                name: "TicketNumber",
                table: "support_tickets",
                newName: "ticket_number");

            migrationBuilder.RenameColumn(
                name: "TenantName",
                table: "support_tickets",
                newName: "tenant_name");

            migrationBuilder.RenameColumn(
                name: "RequestedRole",
                table: "support_tickets",
                newName: "requested_role");

            migrationBuilder.RenameColumn(
                name: "RequestedBy",
                table: "support_tickets",
                newName: "requested_by");

            migrationBuilder.RenameColumn(
                name: "MessageCount",
                table: "support_tickets",
                newName: "message_count");

            migrationBuilder.RenameColumn(
                name: "LastMessage",
                table: "support_tickets",
                newName: "last_message");

            migrationBuilder.RenameColumn(
                name: "CreatedAtUtc",
                table: "support_tickets",
                newName: "created_at_utc");

            migrationBuilder.RenameIndex(
                name: "IX_support_tickets_TicketNumber",
                table: "support_tickets",
                newName: "IX_support_tickets_ticket_number");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "question_practice_attempts",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "SubmittedAtUtc",
                table: "question_practice_attempts",
                newName: "submitted_at_utc");

            migrationBuilder.RenameColumn(
                name: "StudentUsername",
                table: "question_practice_attempts",
                newName: "student_username");

            migrationBuilder.RenameColumn(
                name: "StudentName",
                table: "question_practice_attempts",
                newName: "student_name");

            migrationBuilder.RenameColumn(
                name: "QuestionId",
                table: "question_practice_attempts",
                newName: "question_id");

            migrationBuilder.RenameColumn(
                name: "IsCorrect",
                table: "question_practice_attempts",
                newName: "is_correct");

            migrationBuilder.RenameColumn(
                name: "AnswerText",
                table: "question_practice_attempts",
                newName: "answer_text");

            migrationBuilder.RenameIndex(
                name: "IX_question_practice_attempts_QuestionId_StudentUsername",
                table: "question_practice_attempts",
                newName: "IX_question_practice_attempts_question_id_student_username");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "platform_configurations",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UpdatedAtUtc",
                table: "platform_configurations",
                newName: "updated_at_utc");

            migrationBuilder.RenameColumn(
                name: "ScopeKey",
                table: "platform_configurations",
                newName: "scope_key");

            migrationBuilder.RenameColumn(
                name: "DisplayName",
                table: "platform_configurations",
                newName: "display_name");

            migrationBuilder.RenameColumn(
                name: "ConfigurationType",
                table: "platform_configurations",
                newName: "configuration_type");

            migrationBuilder.RenameIndex(
                name: "IX_platform_configurations_tenant_id_ConfigurationType_ScopeKey",
                table: "platform_configurations",
                newName: "IX_platform_configurations_tenant_id_configuration_type_scope_~");

            migrationBuilder.RenameColumn(
                name: "Note",
                table: "homework_submissions",
                newName: "note");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "homework_submissions",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "SubmittedAtLabel",
                table: "homework_submissions",
                newName: "submitted_at_label");

            migrationBuilder.RenameColumn(
                name: "StudentName",
                table: "homework_submissions",
                newName: "student_name");

            migrationBuilder.RenameColumn(
                name: "AssignmentId",
                table: "homework_submissions",
                newName: "assignment_id");

            migrationBuilder.RenameIndex(
                name: "IX_homework_submissions_AssignmentId",
                table: "homework_submissions",
                newName: "IX_homework_submissions_assignment_id");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "homework_assignments",
                newName: "title");

            migrationBuilder.RenameColumn(
                name: "Teacher",
                table: "homework_assignments",
                newName: "teacher");

            migrationBuilder.RenameColumn(
                name: "Subject",
                table: "homework_assignments",
                newName: "subject");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "homework_assignments",
                newName: "description");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "homework_assignments",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "TotalStudents",
                table: "homework_assignments",
                newName: "total_students");

            migrationBuilder.RenameColumn(
                name: "DeadlineLabel",
                table: "homework_assignments",
                newName: "deadline_label");

            migrationBuilder.RenameColumn(
                name: "CreatedAtLabel",
                table: "homework_assignments",
                newName: "created_at_label");

            migrationBuilder.RenameColumn(
                name: "ClassName",
                table: "homework_assignments",
                newName: "class_name");

            migrationBuilder.RenameColumn(
                name: "Status",
                table: "attendance_entries",
                newName: "status");

            migrationBuilder.RenameColumn(
                name: "Lesson",
                table: "attendance_entries",
                newName: "lesson");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "attendance_entries",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "StudentName",
                table: "attendance_entries",
                newName: "student_name");

            migrationBuilder.RenameColumn(
                name: "LessonDate",
                table: "attendance_entries",
                newName: "lesson_date");

            migrationBuilder.RenameColumn(
                name: "ClassName",
                table: "attendance_entries",
                newName: "class_name");

            migrationBuilder.RenameIndex(
                name: "IX_attendance_entries_ClassName",
                table: "attendance_entries",
                newName: "IX_attendance_entries_class_name");

            migrationBuilder.AlterColumn<string>(
                name: "PendingAdminPasswordHash",
                table: "tenant_workspaces",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "status",
                table: "tenant_workspaces",
                newName: "Status");

            migrationBuilder.RenameColumn(
                name: "slug",
                table: "tenant_workspaces",
                newName: "Slug");

            migrationBuilder.RenameColumn(
                name: "plan",
                table: "tenant_workspaces",
                newName: "Plan");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "tenant_workspaces",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "tenant_workspaces",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "user_count",
                table: "tenant_workspaces",
                newName: "UserCount");

            migrationBuilder.RenameColumn(
                name: "student_count",
                table: "tenant_workspaces",
                newName: "StudentCount");

            migrationBuilder.RenameColumn(
                name: "storage_used_gb",
                table: "tenant_workspaces",
                newName: "StorageUsedGb");

            migrationBuilder.RenameColumn(
                name: "staff_count",
                table: "tenant_workspaces",
                newName: "StaffCount");

            migrationBuilder.RenameColumn(
                name: "monthly_fee",
                table: "tenant_workspaces",
                newName: "MonthlyFee");

            migrationBuilder.RenameColumn(
                name: "created_at_utc",
                table: "tenant_workspaces",
                newName: "CreatedAtUtc");

            migrationBuilder.RenameColumn(
                name: "contact_email",
                table: "tenant_workspaces",
                newName: "ContactEmail");

            migrationBuilder.RenameColumn(
                name: "collected_amount",
                table: "tenant_workspaces",
                newName: "CollectedAmount");

            migrationBuilder.RenameColumn(
                name: "branch_count",
                table: "tenant_workspaces",
                newName: "BranchCount");

            migrationBuilder.RenameColumn(
                name: "api_usage",
                table: "tenant_workspaces",
                newName: "ApiUsage");

            migrationBuilder.RenameIndex(
                name: "IX_tenant_workspaces_slug",
                table: "tenant_workspaces",
                newName: "IX_tenant_workspaces_Slug");

            migrationBuilder.RenameColumn(
                name: "summary",
                table: "support_tickets",
                newName: "Summary");

            migrationBuilder.RenameColumn(
                name: "subject",
                table: "support_tickets",
                newName: "Subject");

            migrationBuilder.RenameColumn(
                name: "status",
                table: "support_tickets",
                newName: "Status");

            migrationBuilder.RenameColumn(
                name: "priority",
                table: "support_tickets",
                newName: "Priority");

            migrationBuilder.RenameColumn(
                name: "category",
                table: "support_tickets",
                newName: "Category");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "support_tickets",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "updated_at_utc",
                table: "support_tickets",
                newName: "UpdatedAtUtc");

            migrationBuilder.RenameColumn(
                name: "ticket_number",
                table: "support_tickets",
                newName: "TicketNumber");

            migrationBuilder.RenameColumn(
                name: "tenant_name",
                table: "support_tickets",
                newName: "TenantName");

            migrationBuilder.RenameColumn(
                name: "requested_role",
                table: "support_tickets",
                newName: "RequestedRole");

            migrationBuilder.RenameColumn(
                name: "requested_by",
                table: "support_tickets",
                newName: "RequestedBy");

            migrationBuilder.RenameColumn(
                name: "message_count",
                table: "support_tickets",
                newName: "MessageCount");

            migrationBuilder.RenameColumn(
                name: "last_message",
                table: "support_tickets",
                newName: "LastMessage");

            migrationBuilder.RenameColumn(
                name: "created_at_utc",
                table: "support_tickets",
                newName: "CreatedAtUtc");

            migrationBuilder.RenameIndex(
                name: "IX_support_tickets_ticket_number",
                table: "support_tickets",
                newName: "IX_support_tickets_TicketNumber");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "question_practice_attempts",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "submitted_at_utc",
                table: "question_practice_attempts",
                newName: "SubmittedAtUtc");

            migrationBuilder.RenameColumn(
                name: "student_username",
                table: "question_practice_attempts",
                newName: "StudentUsername");

            migrationBuilder.RenameColumn(
                name: "student_name",
                table: "question_practice_attempts",
                newName: "StudentName");

            migrationBuilder.RenameColumn(
                name: "question_id",
                table: "question_practice_attempts",
                newName: "QuestionId");

            migrationBuilder.RenameColumn(
                name: "is_correct",
                table: "question_practice_attempts",
                newName: "IsCorrect");

            migrationBuilder.RenameColumn(
                name: "answer_text",
                table: "question_practice_attempts",
                newName: "AnswerText");

            migrationBuilder.RenameIndex(
                name: "IX_question_practice_attempts_question_id_student_username",
                table: "question_practice_attempts",
                newName: "IX_question_practice_attempts_QuestionId_StudentUsername");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "platform_configurations",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "updated_at_utc",
                table: "platform_configurations",
                newName: "UpdatedAtUtc");

            migrationBuilder.RenameColumn(
                name: "scope_key",
                table: "platform_configurations",
                newName: "ScopeKey");

            migrationBuilder.RenameColumn(
                name: "display_name",
                table: "platform_configurations",
                newName: "DisplayName");

            migrationBuilder.RenameColumn(
                name: "configuration_type",
                table: "platform_configurations",
                newName: "ConfigurationType");

            migrationBuilder.RenameIndex(
                name: "IX_platform_configurations_tenant_id_configuration_type_scope_~",
                table: "platform_configurations",
                newName: "IX_platform_configurations_tenant_id_ConfigurationType_ScopeKey");

            migrationBuilder.RenameColumn(
                name: "note",
                table: "homework_submissions",
                newName: "Note");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "homework_submissions",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "submitted_at_label",
                table: "homework_submissions",
                newName: "SubmittedAtLabel");

            migrationBuilder.RenameColumn(
                name: "student_name",
                table: "homework_submissions",
                newName: "StudentName");

            migrationBuilder.RenameColumn(
                name: "assignment_id",
                table: "homework_submissions",
                newName: "AssignmentId");

            migrationBuilder.RenameIndex(
                name: "IX_homework_submissions_assignment_id",
                table: "homework_submissions",
                newName: "IX_homework_submissions_AssignmentId");

            migrationBuilder.RenameColumn(
                name: "title",
                table: "homework_assignments",
                newName: "Title");

            migrationBuilder.RenameColumn(
                name: "teacher",
                table: "homework_assignments",
                newName: "Teacher");

            migrationBuilder.RenameColumn(
                name: "subject",
                table: "homework_assignments",
                newName: "Subject");

            migrationBuilder.RenameColumn(
                name: "description",
                table: "homework_assignments",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "homework_assignments",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "total_students",
                table: "homework_assignments",
                newName: "TotalStudents");

            migrationBuilder.RenameColumn(
                name: "deadline_label",
                table: "homework_assignments",
                newName: "DeadlineLabel");

            migrationBuilder.RenameColumn(
                name: "created_at_label",
                table: "homework_assignments",
                newName: "CreatedAtLabel");

            migrationBuilder.RenameColumn(
                name: "class_name",
                table: "homework_assignments",
                newName: "ClassName");

            migrationBuilder.RenameColumn(
                name: "status",
                table: "attendance_entries",
                newName: "Status");

            migrationBuilder.RenameColumn(
                name: "lesson",
                table: "attendance_entries",
                newName: "Lesson");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "attendance_entries",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "student_name",
                table: "attendance_entries",
                newName: "StudentName");

            migrationBuilder.RenameColumn(
                name: "lesson_date",
                table: "attendance_entries",
                newName: "LessonDate");

            migrationBuilder.RenameColumn(
                name: "class_name",
                table: "attendance_entries",
                newName: "ClassName");

            migrationBuilder.RenameIndex(
                name: "IX_attendance_entries_class_name",
                table: "attendance_entries",
                newName: "IX_attendance_entries_ClassName");

            migrationBuilder.AlterColumn<string>(
                name: "PendingAdminPasswordHash",
                table: "tenant_workspaces",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300,
                oldNullable: true);
        }
    }
}
