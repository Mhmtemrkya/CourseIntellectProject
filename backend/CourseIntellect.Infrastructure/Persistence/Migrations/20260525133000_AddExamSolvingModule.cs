using System;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(CourseIntellectDbContext))]
    [Migration("20260525133000_AddExamSolvingModule")]
    public partial class AddExamSolvingModule : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "exam_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    planned_exam_id = table.Column<Guid>(type: "uuid", nullable: true),
                    student_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    teacher_preview_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    student_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    student_username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    class_name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    title = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: false),
                    subject = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    duration_seconds = table.Column<int>(type: "integer", nullable: false),
                    is_teacher_preview = table.Column<bool>(type: "boolean", nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    started_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_sessions", x => x.id);
                    table.ForeignKey("FK_exam_sessions_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "exam_questions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    planned_exam_id = table.Column<Guid>(type: "uuid", nullable: true),
                    question_bank_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    point = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_questions", x => x.id);
                    table.ForeignKey("FK_exam_questions_question_bank_items_question_bank_item_id", x => x.question_bank_item_id, "question_bank_items", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_exam_questions_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "question_attempts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    exam_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    question_bank_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    is_flagged = table.Column<bool>(type: "boolean", nullable: false),
                    flag_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    time_spent_seconds = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_interaction_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_question_attempts", x => x.id);
                    table.ForeignKey("FK_question_attempts_exam_sessions_exam_session_id", x => x.exam_session_id, "exam_sessions", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_question_attempts_question_bank_items_question_bank_item_id", x => x.question_bank_item_id, "question_bank_items", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_question_attempts_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "answer_selections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    question_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    selected_option_index = table.Column<int>(type: "integer", nullable: false),
                    open_answer = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    is_correct = table.Column<bool>(type: "boolean", nullable: false),
                    saved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_answer_selections", x => x.id);
                    table.ForeignKey("FK_answer_selections_question_attempts_question_attempt_id", x => x.question_attempt_id, "question_attempts", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_answer_selections_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "canvas_strokes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    question_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tool = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    color = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    width = table.Column<decimal>(type: "numeric", nullable: false),
                    opacity = table.Column<decimal>(type: "numeric", nullable: false),
                    pressure = table.Column<decimal>(type: "numeric", nullable: true),
                    points_json = table.Column<string>(type: "jsonb", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_canvas_strokes", x => x.id);
                    table.ForeignKey("FK_canvas_strokes_question_attempts_question_attempt_id", x => x.question_attempt_id, "question_attempts", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_canvas_strokes_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "canvas_snapshots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    question_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    storage_key = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false),
                    content_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_canvas_snapshots", x => x.id);
                    table.ForeignKey("FK_canvas_snapshots_question_attempts_question_attempt_id", x => x.question_attempt_id, "question_attempts", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_canvas_snapshots_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "student_notes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    question_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    note = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_notes", x => x.id);
                    table.ForeignKey("FK_student_notes_question_attempts_question_attempt_id", x => x.question_attempt_id, "question_attempts", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_student_notes_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "pdf_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    exam_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    storage_key = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: true),
                    error_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ready_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pdf_reports", x => x.id);
                    table.ForeignKey("FK_pdf_reports_exam_sessions_exam_session_id", x => x.exam_session_id, "exam_sessions", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_pdf_reports_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "teacher_review_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    question_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    teacher_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    teacher_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    comment = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teacher_review_comments", x => x.id);
                    table.ForeignKey("FK_teacher_review_comments_question_attempts_question_attempt_id", x => x.question_attempt_id, "question_attempts", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_teacher_review_comments_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "report_recipients",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    pdf_report_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_report_recipients", x => x.id);
                    table.ForeignKey("FK_report_recipients_pdf_reports_pdf_report_id", x => x.pdf_report_id, "pdf_reports", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_report_recipients_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "live_exam_states",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    exam_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    active_question_attempt_id = table.Column<Guid>(type: "uuid", nullable: true),
                    remaining_seconds = table.Column<int>(type: "integer", nullable: false),
                    status_summary_json = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_live_exam_states", x => x.id);
                    table.ForeignKey("FK_live_exam_states_exam_sessions_exam_session_id", x => x.exam_session_id, "exam_sessions", "id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_live_exam_states_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex("IX_exam_sessions_tenant_id_student_username_status", "exam_sessions", new[] { "tenant_id", "student_username", "status" });
            migrationBuilder.CreateIndex("IX_exam_questions_planned_exam_id_sort_order", "exam_questions", new[] { "planned_exam_id", "sort_order" });
            migrationBuilder.CreateIndex("IX_question_attempts_exam_session_id_sort_order", "question_attempts", new[] { "exam_session_id", "sort_order" }, unique: true);
            migrationBuilder.CreateIndex("IX_question_attempts_question_bank_item_id", "question_attempts", "question_bank_item_id");
            migrationBuilder.CreateIndex("IX_answer_selections_question_attempt_id", "answer_selections", "question_attempt_id");
            migrationBuilder.CreateIndex("IX_canvas_strokes_question_attempt_id_created_at_utc", "canvas_strokes", new[] { "question_attempt_id", "created_at_utc" });
            migrationBuilder.CreateIndex("IX_canvas_snapshots_question_attempt_id_created_at_utc", "canvas_snapshots", new[] { "question_attempt_id", "created_at_utc" });
            migrationBuilder.CreateIndex("IX_student_notes_question_attempt_id", "student_notes", "question_attempt_id", unique: true);
            migrationBuilder.CreateIndex("IX_pdf_reports_exam_session_id_status", "pdf_reports", new[] { "exam_session_id", "status" });
            migrationBuilder.CreateIndex("IX_teacher_review_comments_question_attempt_id_teacher_user_id", "teacher_review_comments", new[] { "question_attempt_id", "teacher_user_id" });
            migrationBuilder.CreateIndex("IX_report_recipients_pdf_report_id_role", "report_recipients", new[] { "pdf_report_id", "role" });
            migrationBuilder.CreateIndex("IX_live_exam_states_exam_session_id", "live_exam_states", "exam_session_id", unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("live_exam_states");
            migrationBuilder.DropTable("report_recipients");
            migrationBuilder.DropTable("teacher_review_comments");
            migrationBuilder.DropTable("pdf_reports");
            migrationBuilder.DropTable("student_notes");
            migrationBuilder.DropTable("canvas_snapshots");
            migrationBuilder.DropTable("canvas_strokes");
            migrationBuilder.DropTable("answer_selections");
            migrationBuilder.DropTable("exam_questions");
            migrationBuilder.DropTable("question_attempts");
            migrationBuilder.DropTable("exam_sessions");
        }
    }
}
