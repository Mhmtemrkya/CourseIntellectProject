using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantScopedBusinessData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_study_plan_states_StudentName",
                table: "study_plan_states");

            migrationBuilder.DropIndex(
                name: "IX_site_content_items_SectionKey_Language_Version",
                table: "site_content_items");

            migrationBuilder.DropIndex(
                name: "IX_platform_configurations_ConfigurationType_ScopeKey",
                table: "platform_configurations");

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "study_plan_states",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "student_question_threads",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "student_question_replies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "student_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "staff_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "site_content_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "question_practice_attempts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "question_bank_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "platform_configurations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "message_threads",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "message_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "meeting_requests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "homework_submissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "homework_assignments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "exam_results",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "content_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "attendance_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "announcements",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "accounting_salaries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "accounting_notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "accounting_invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "accounting_installments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "accounting_collections",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "accounting_audit_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "tenant_id",
                table: "accounting_approvals",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_study_plan_states_tenant_id",
                table: "study_plan_states",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_study_plan_states_tenant_id_StudentName",
                table: "study_plan_states",
                columns: new[] { "tenant_id", "StudentName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_student_question_threads_tenant_id",
                table: "student_question_threads",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_question_replies_tenant_id",
                table: "student_question_replies",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_profiles_tenant_id",
                table: "student_profiles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_profiles_tenant_id",
                table: "staff_profiles",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_site_content_items_tenant_id",
                table: "site_content_items",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_site_content_items_tenant_id_SectionKey_Language_Version",
                table: "site_content_items",
                columns: new[] { "tenant_id", "SectionKey", "Language", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_question_practice_attempts_tenant_id",
                table: "question_practice_attempts",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_question_bank_items_tenant_id",
                table: "question_bank_items",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_platform_configurations_tenant_id",
                table: "platform_configurations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_platform_configurations_tenant_id_ConfigurationType_ScopeKey",
                table: "platform_configurations",
                columns: new[] { "tenant_id", "ConfigurationType", "ScopeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notifications_tenant_id",
                table: "notifications",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_threads_tenant_id",
                table: "message_threads",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_items_tenant_id",
                table: "message_items",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_meeting_requests_tenant_id",
                table: "meeting_requests",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_homework_submissions_tenant_id",
                table: "homework_submissions",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_homework_assignments_tenant_id",
                table: "homework_assignments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_exam_results_tenant_id",
                table: "exam_results",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_tenant_id",
                table: "content_items",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_entries_tenant_id",
                table: "attendance_entries",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_announcements_tenant_id",
                table: "announcements",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_accounting_salaries_tenant_id",
                table: "accounting_salaries",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_accounting_notifications_tenant_id",
                table: "accounting_notifications",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_accounting_invoices_tenant_id",
                table: "accounting_invoices",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_accounting_installments_tenant_id",
                table: "accounting_installments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_accounting_collections_tenant_id",
                table: "accounting_collections",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_accounting_audit_logs_tenant_id",
                table: "accounting_audit_logs",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_accounting_approvals_tenant_id",
                table: "accounting_approvals",
                column: "tenant_id");

            migrationBuilder.AddForeignKey(
                name: "FK_accounting_approvals_tenant_workspaces_tenant_id",
                table: "accounting_approvals",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_accounting_audit_logs_tenant_workspaces_tenant_id",
                table: "accounting_audit_logs",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_accounting_collections_tenant_workspaces_tenant_id",
                table: "accounting_collections",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_accounting_installments_tenant_workspaces_tenant_id",
                table: "accounting_installments",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_accounting_invoices_tenant_workspaces_tenant_id",
                table: "accounting_invoices",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_accounting_notifications_tenant_workspaces_tenant_id",
                table: "accounting_notifications",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_accounting_salaries_tenant_workspaces_tenant_id",
                table: "accounting_salaries",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_announcements_tenant_workspaces_tenant_id",
                table: "announcements",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_entries_tenant_workspaces_tenant_id",
                table: "attendance_entries",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_content_items_tenant_workspaces_tenant_id",
                table: "content_items",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_exam_results_tenant_workspaces_tenant_id",
                table: "exam_results",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_homework_assignments_tenant_workspaces_tenant_id",
                table: "homework_assignments",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_homework_submissions_tenant_workspaces_tenant_id",
                table: "homework_submissions",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_meeting_requests_tenant_workspaces_tenant_id",
                table: "meeting_requests",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_message_items_tenant_workspaces_tenant_id",
                table: "message_items",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_message_threads_tenant_workspaces_tenant_id",
                table: "message_threads",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_notifications_tenant_workspaces_tenant_id",
                table: "notifications",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_platform_configurations_tenant_workspaces_tenant_id",
                table: "platform_configurations",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_question_bank_items_tenant_workspaces_tenant_id",
                table: "question_bank_items",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_question_practice_attempts_tenant_workspaces_tenant_id",
                table: "question_practice_attempts",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_site_content_items_tenant_workspaces_tenant_id",
                table: "site_content_items",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_staff_profiles_tenant_workspaces_tenant_id",
                table: "staff_profiles",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_student_profiles_tenant_workspaces_tenant_id",
                table: "student_profiles",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_student_question_replies_tenant_workspaces_tenant_id",
                table: "student_question_replies",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_student_question_threads_tenant_workspaces_tenant_id",
                table: "student_question_threads",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_study_plan_states_tenant_workspaces_tenant_id",
                table: "study_plan_states",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_accounting_approvals_tenant_workspaces_tenant_id",
                table: "accounting_approvals");

            migrationBuilder.DropForeignKey(
                name: "FK_accounting_audit_logs_tenant_workspaces_tenant_id",
                table: "accounting_audit_logs");

            migrationBuilder.DropForeignKey(
                name: "FK_accounting_collections_tenant_workspaces_tenant_id",
                table: "accounting_collections");

            migrationBuilder.DropForeignKey(
                name: "FK_accounting_installments_tenant_workspaces_tenant_id",
                table: "accounting_installments");

            migrationBuilder.DropForeignKey(
                name: "FK_accounting_invoices_tenant_workspaces_tenant_id",
                table: "accounting_invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_accounting_notifications_tenant_workspaces_tenant_id",
                table: "accounting_notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_accounting_salaries_tenant_workspaces_tenant_id",
                table: "accounting_salaries");

            migrationBuilder.DropForeignKey(
                name: "FK_announcements_tenant_workspaces_tenant_id",
                table: "announcements");

            migrationBuilder.DropForeignKey(
                name: "FK_attendance_entries_tenant_workspaces_tenant_id",
                table: "attendance_entries");

            migrationBuilder.DropForeignKey(
                name: "FK_content_items_tenant_workspaces_tenant_id",
                table: "content_items");

            migrationBuilder.DropForeignKey(
                name: "FK_exam_results_tenant_workspaces_tenant_id",
                table: "exam_results");

            migrationBuilder.DropForeignKey(
                name: "FK_homework_assignments_tenant_workspaces_tenant_id",
                table: "homework_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_homework_submissions_tenant_workspaces_tenant_id",
                table: "homework_submissions");

            migrationBuilder.DropForeignKey(
                name: "FK_meeting_requests_tenant_workspaces_tenant_id",
                table: "meeting_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_message_items_tenant_workspaces_tenant_id",
                table: "message_items");

            migrationBuilder.DropForeignKey(
                name: "FK_message_threads_tenant_workspaces_tenant_id",
                table: "message_threads");

            migrationBuilder.DropForeignKey(
                name: "FK_notifications_tenant_workspaces_tenant_id",
                table: "notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_platform_configurations_tenant_workspaces_tenant_id",
                table: "platform_configurations");

            migrationBuilder.DropForeignKey(
                name: "FK_question_bank_items_tenant_workspaces_tenant_id",
                table: "question_bank_items");

            migrationBuilder.DropForeignKey(
                name: "FK_question_practice_attempts_tenant_workspaces_tenant_id",
                table: "question_practice_attempts");

            migrationBuilder.DropForeignKey(
                name: "FK_site_content_items_tenant_workspaces_tenant_id",
                table: "site_content_items");

            migrationBuilder.DropForeignKey(
                name: "FK_staff_profiles_tenant_workspaces_tenant_id",
                table: "staff_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_student_profiles_tenant_workspaces_tenant_id",
                table: "student_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_student_question_replies_tenant_workspaces_tenant_id",
                table: "student_question_replies");

            migrationBuilder.DropForeignKey(
                name: "FK_student_question_threads_tenant_workspaces_tenant_id",
                table: "student_question_threads");

            migrationBuilder.DropForeignKey(
                name: "FK_study_plan_states_tenant_workspaces_tenant_id",
                table: "study_plan_states");

            migrationBuilder.DropIndex(
                name: "IX_study_plan_states_tenant_id",
                table: "study_plan_states");

            migrationBuilder.DropIndex(
                name: "IX_study_plan_states_tenant_id_StudentName",
                table: "study_plan_states");

            migrationBuilder.DropIndex(
                name: "IX_student_question_threads_tenant_id",
                table: "student_question_threads");

            migrationBuilder.DropIndex(
                name: "IX_student_question_replies_tenant_id",
                table: "student_question_replies");

            migrationBuilder.DropIndex(
                name: "IX_student_profiles_tenant_id",
                table: "student_profiles");

            migrationBuilder.DropIndex(
                name: "IX_staff_profiles_tenant_id",
                table: "staff_profiles");

            migrationBuilder.DropIndex(
                name: "IX_site_content_items_tenant_id",
                table: "site_content_items");

            migrationBuilder.DropIndex(
                name: "IX_site_content_items_tenant_id_SectionKey_Language_Version",
                table: "site_content_items");

            migrationBuilder.DropIndex(
                name: "IX_question_practice_attempts_tenant_id",
                table: "question_practice_attempts");

            migrationBuilder.DropIndex(
                name: "IX_question_bank_items_tenant_id",
                table: "question_bank_items");

            migrationBuilder.DropIndex(
                name: "IX_platform_configurations_tenant_id",
                table: "platform_configurations");

            migrationBuilder.DropIndex(
                name: "IX_platform_configurations_tenant_id_ConfigurationType_ScopeKey",
                table: "platform_configurations");

            migrationBuilder.DropIndex(
                name: "IX_notifications_tenant_id",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "IX_message_threads_tenant_id",
                table: "message_threads");

            migrationBuilder.DropIndex(
                name: "IX_message_items_tenant_id",
                table: "message_items");

            migrationBuilder.DropIndex(
                name: "IX_meeting_requests_tenant_id",
                table: "meeting_requests");

            migrationBuilder.DropIndex(
                name: "IX_homework_submissions_tenant_id",
                table: "homework_submissions");

            migrationBuilder.DropIndex(
                name: "IX_homework_assignments_tenant_id",
                table: "homework_assignments");

            migrationBuilder.DropIndex(
                name: "IX_exam_results_tenant_id",
                table: "exam_results");

            migrationBuilder.DropIndex(
                name: "IX_content_items_tenant_id",
                table: "content_items");

            migrationBuilder.DropIndex(
                name: "IX_attendance_entries_tenant_id",
                table: "attendance_entries");

            migrationBuilder.DropIndex(
                name: "IX_announcements_tenant_id",
                table: "announcements");

            migrationBuilder.DropIndex(
                name: "IX_accounting_salaries_tenant_id",
                table: "accounting_salaries");

            migrationBuilder.DropIndex(
                name: "IX_accounting_notifications_tenant_id",
                table: "accounting_notifications");

            migrationBuilder.DropIndex(
                name: "IX_accounting_invoices_tenant_id",
                table: "accounting_invoices");

            migrationBuilder.DropIndex(
                name: "IX_accounting_installments_tenant_id",
                table: "accounting_installments");

            migrationBuilder.DropIndex(
                name: "IX_accounting_collections_tenant_id",
                table: "accounting_collections");

            migrationBuilder.DropIndex(
                name: "IX_accounting_audit_logs_tenant_id",
                table: "accounting_audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_accounting_approvals_tenant_id",
                table: "accounting_approvals");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "study_plan_states");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "student_question_threads");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "student_question_replies");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "student_profiles");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "staff_profiles");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "site_content_items");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "question_practice_attempts");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "question_bank_items");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "platform_configurations");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "message_threads");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "message_items");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "meeting_requests");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "homework_submissions");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "homework_assignments");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "exam_results");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "content_items");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "attendance_entries");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "announcements");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "accounting_salaries");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "accounting_notifications");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "accounting_invoices");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "accounting_installments");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "accounting_collections");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "accounting_audit_logs");

            migrationBuilder.DropColumn(
                name: "tenant_id",
                table: "accounting_approvals");

            migrationBuilder.CreateIndex(
                name: "IX_study_plan_states_StudentName",
                table: "study_plan_states",
                column: "StudentName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_site_content_items_SectionKey",
                table: "site_content_items",
                column: "SectionKey");

            migrationBuilder.CreateIndex(
                name: "IX_platform_configurations_ConfigurationType_ScopeKey",
                table: "platform_configurations",
                columns: new[] { "ConfigurationType", "ScopeKey" },
                unique: true);
        }
    }
}
