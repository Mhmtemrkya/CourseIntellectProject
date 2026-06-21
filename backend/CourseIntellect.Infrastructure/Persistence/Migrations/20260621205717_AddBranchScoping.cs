using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchScoping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "TenantId",
                table: "TeacherTimetableSlots",
                newName: "tenant_id");

            migrationBuilder.RenameColumn(
                name: "TenantId",
                table: "TeacherDuties",
                newName: "tenant_id");

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "TeacherDuties",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "student_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "staff_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "finance_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "finance_installments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "exam_sessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "enrollment_contracts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "attendance_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_branch_id",
                table: "users",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherTimetableSlots_tenant_id",
                table: "TeacherTimetableSlots",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherDuties_branch_id",
                table: "TeacherDuties",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherDuties_tenant_id",
                table: "TeacherDuties",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_profiles_branch_id",
                table: "student_profiles",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_profiles_branch_id",
                table: "staff_profiles",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payments_branch_id",
                table: "finance_payments",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_finance_installments_branch_id",
                table: "finance_installments",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_exam_sessions_branch_id",
                table: "exam_sessions",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_enrollment_contracts_branch_id",
                table: "enrollment_contracts",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_entries_branch_id",
                table: "attendance_entries",
                column: "branch_id");

            migrationBuilder.AddForeignKey(
                name: "FK_TeacherDuties_tenant_workspaces_tenant_id",
                table: "TeacherDuties",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TeacherTimetableSlots_tenant_workspaces_tenant_id",
                table: "TeacherTimetableSlots",
                column: "tenant_id",
                principalTable: "tenant_workspaces",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TeacherDuties_tenant_workspaces_tenant_id",
                table: "TeacherDuties");

            migrationBuilder.DropForeignKey(
                name: "FK_TeacherTimetableSlots_tenant_workspaces_tenant_id",
                table: "TeacherTimetableSlots");

            migrationBuilder.DropIndex(
                name: "IX_users_branch_id",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_TeacherTimetableSlots_tenant_id",
                table: "TeacherTimetableSlots");

            migrationBuilder.DropIndex(
                name: "IX_TeacherDuties_branch_id",
                table: "TeacherDuties");

            migrationBuilder.DropIndex(
                name: "IX_TeacherDuties_tenant_id",
                table: "TeacherDuties");

            migrationBuilder.DropIndex(
                name: "IX_student_profiles_branch_id",
                table: "student_profiles");

            migrationBuilder.DropIndex(
                name: "IX_staff_profiles_branch_id",
                table: "staff_profiles");

            migrationBuilder.DropIndex(
                name: "IX_finance_payments_branch_id",
                table: "finance_payments");

            migrationBuilder.DropIndex(
                name: "IX_finance_installments_branch_id",
                table: "finance_installments");

            migrationBuilder.DropIndex(
                name: "IX_exam_sessions_branch_id",
                table: "exam_sessions");

            migrationBuilder.DropIndex(
                name: "IX_enrollment_contracts_branch_id",
                table: "enrollment_contracts");

            migrationBuilder.DropIndex(
                name: "IX_attendance_entries_branch_id",
                table: "attendance_entries");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "TeacherDuties");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "student_profiles");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "staff_profiles");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "finance_payments");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "finance_installments");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "exam_sessions");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "enrollment_contracts");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "attendance_entries");

            migrationBuilder.RenameColumn(
                name: "tenant_id",
                table: "TeacherTimetableSlots",
                newName: "TenantId");

            migrationBuilder.RenameColumn(
                name: "tenant_id",
                table: "TeacherDuties",
                newName: "TenantId");
        }
    }
}
