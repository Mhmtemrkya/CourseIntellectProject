using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HardenDomainIdentityReceiptsAndDrivingProvenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "StudentUserId",
                table: "student_question_threads",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TeacherUserId",
                table: "student_question_threads",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SenderUserId",
                table: "student_question_replies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParticipantOneUserId",
                table: "message_threads",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParticipantTwoUserId",
                table: "message_threads",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SenderUserId",
                table: "message_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StudentUserId",
                table: "homework_submissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DrivingChargeId",
                table: "driving_lesson_ledger_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "finance_receipt_sequences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Period = table.Column<string>(type: "character varying(39)", maxLength: 39, nullable: false),
                    LastValue = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_finance_receipt_sequences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_finance_receipt_sequences_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            // Backfill immutable identities only when the same-tenant source is
            // unambiguous. Ambiguous and unmatched legacy rows deliberately remain
            // nullable and continue through the legacy compatibility path.
            migrationBuilder.Sql("""
                UPDATE homework_submissions h
                SET "StudentUserId" = u."Id"
                FROM users u
                WHERE h.tenant_id = u.tenant_id
                  AND lower(trim(h.student_name)) = lower(trim(u."FullName"))
                  AND u."PrimaryRole" = 6
                  AND u."Status" = 1
                  AND 1 = (SELECT count(*) FROM users ux
                           WHERE ux.tenant_id = h.tenant_id
                             AND lower(trim(ux."FullName")) = lower(trim(h.student_name))
                             AND ux."PrimaryRole" = 6 AND ux."Status" = 1);

                UPDATE student_question_threads q
                SET "StudentUserId" = u."Id"
                FROM users u
                WHERE q.tenant_id = u.tenant_id
                  AND q."StudentUsername" <> ''
                  AND lower(q."StudentUsername") = lower(u."Username")
                  AND u."PrimaryRole" = 6 AND u."Status" = 1;

                UPDATE student_question_threads q
                SET "TeacherUserId" = u."Id"
                FROM users u
                WHERE q.tenant_id = u.tenant_id
                  AND lower(trim(q."TeacherName")) = lower(trim(u."FullName"))
                  AND u."PrimaryRole" = 2 AND u."Status" = 1
                  AND 1 = (SELECT count(*) FROM users ux
                           WHERE ux.tenant_id = q.tenant_id
                             AND lower(trim(ux."FullName")) = lower(trim(q."TeacherName"))
                             AND ux."PrimaryRole" = 2 AND ux."Status" = 1);

                UPDATE message_threads m
                SET "ParticipantOneUserId" = u."Id"
                FROM users u
                WHERE m.tenant_id = u.tenant_id
                  AND lower(trim(m."ParticipantOneName")) = lower(trim(u."FullName"))
                  AND u."PrimaryRole" = CASE lower(m."ParticipantOneRole")
                      WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 WHEN 'accounting' THEN 3
                      WHEN 'administrative' THEN 4 WHEN 'parent' THEN 5 WHEN 'student' THEN 6
                      WHEN 'developer' THEN 7 WHEN 'cafeteria' THEN 8 WHEN 'branchmanager' THEN 9 ELSE 0 END
                  AND u."Status" = 1
                  AND 1 = (SELECT count(*) FROM users ux
                           WHERE ux.tenant_id = m.tenant_id
                             AND lower(trim(ux."FullName")) = lower(trim(m."ParticipantOneName"))
                             AND ux."PrimaryRole" = CASE lower(m."ParticipantOneRole")
                                 WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 WHEN 'accounting' THEN 3
                                 WHEN 'administrative' THEN 4 WHEN 'parent' THEN 5 WHEN 'student' THEN 6
                                 WHEN 'developer' THEN 7 WHEN 'cafeteria' THEN 8 WHEN 'branchmanager' THEN 9 ELSE 0 END
                             AND ux."Status" = 1);

                UPDATE message_threads m
                SET "ParticipantTwoUserId" = u."Id"
                FROM users u
                WHERE m.tenant_id = u.tenant_id
                  AND lower(trim(m."ParticipantTwoName")) = lower(trim(u."FullName"))
                  AND u."PrimaryRole" = CASE lower(m."ParticipantTwoRole")
                      WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 WHEN 'accounting' THEN 3
                      WHEN 'administrative' THEN 4 WHEN 'parent' THEN 5 WHEN 'student' THEN 6
                      WHEN 'developer' THEN 7 WHEN 'cafeteria' THEN 8 WHEN 'branchmanager' THEN 9 ELSE 0 END
                  AND u."Status" = 1
                  AND 1 = (SELECT count(*) FROM users ux
                           WHERE ux.tenant_id = m.tenant_id
                             AND lower(trim(ux."FullName")) = lower(trim(m."ParticipantTwoName"))
                             AND ux."PrimaryRole" = CASE lower(m."ParticipantTwoRole")
                                 WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 WHEN 'accounting' THEN 3
                                 WHEN 'administrative' THEN 4 WHEN 'parent' THEN 5 WHEN 'student' THEN 6
                                 WHEN 'developer' THEN 7 WHEN 'cafeteria' THEN 8 WHEN 'branchmanager' THEN 9 ELSE 0 END
                             AND ux."Status" = 1);

                UPDATE message_items i
                SET "SenderUserId" = CASE
                    WHEN lower(trim(i."SenderName")) = lower(trim(t."ParticipantOneName")) THEN t."ParticipantOneUserId"
                    WHEN lower(trim(i."SenderName")) = lower(trim(t."ParticipantTwoName")) THEN t."ParticipantTwoUserId"
                    ELSE NULL END
                FROM message_threads t
                WHERE i."ThreadId" = t."Id" AND i.tenant_id = t.tenant_id;

                UPDATE student_question_replies r
                SET "SenderUserId" = CASE
                    WHEN lower(r."SenderRole") = 'student' THEN q."StudentUserId"
                    WHEN lower(r."SenderRole") = 'teacher' THEN q."TeacherUserId"
                    ELSE NULL END
                FROM student_question_threads q
                WHERE r."ThreadId" = q."Id" AND r.tenant_id = q.tenant_id;
                """);

            // Preserve one historical receipt verbatim and deterministically rename
            // only duplicate siblings so the forward-only unique index can be added.
            migrationBuilder.Sql("""
                WITH duplicates AS (
                    SELECT "Id", row_number() OVER (
                        PARTITION BY tenant_id, "ReceiptNo" ORDER BY "PaidAtUtc", "Id") AS rn
                    FROM finance_payments
                    WHERE tenant_id IS NOT NULL AND "ReceiptNo" <> ''
                )
                UPDATE finance_payments p
                SET "ReceiptNo" = left(p."ReceiptNo", 29) || '-L-' || left(replace(p."Id"::text, '-', ''), 8)
                FROM duplicates d
                WHERE p."Id" = d."Id" AND d.rn > 1;

                INSERT INTO finance_receipt_sequences ("Id", tenant_id, "Period", "LastValue")
                SELECT gen_random_uuid(), tenant_id,
                       replace(tenant_id::text, '-', '') || ':' || substring("ReceiptNo" from 5 for 6),
                       max(right("ReceiptNo", 5)::integer)
                FROM finance_payments
                WHERE tenant_id IS NOT NULL
                  AND "ReceiptNo" ~ '^MKB-[0-9]{6}-[0-9]{5}$'
                GROUP BY tenant_id, substring("ReceiptNo" from 5 for 6);
                """);

            migrationBuilder.CreateIndex(
                name: "IX_student_question_threads_StudentUserId",
                table: "student_question_threads",
                column: "StudentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_student_question_threads_TeacherUserId",
                table: "student_question_threads",
                column: "TeacherUserId");

            migrationBuilder.CreateIndex(
                name: "IX_student_question_replies_SenderUserId",
                table: "student_question_replies",
                column: "SenderUserId");

            migrationBuilder.CreateIndex(
                name: "IX_message_threads_ParticipantOneUserId",
                table: "message_threads",
                column: "ParticipantOneUserId");

            migrationBuilder.CreateIndex(
                name: "IX_message_threads_ParticipantTwoUserId",
                table: "message_threads",
                column: "ParticipantTwoUserId");

            migrationBuilder.CreateIndex(
                name: "IX_message_items_SenderUserId",
                table: "message_items",
                column: "SenderUserId");

            migrationBuilder.CreateIndex(
                name: "IX_homework_submissions_StudentUserId",
                table: "homework_submissions",
                column: "StudentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_payments_tenant_id_ReceiptNo",
                table: "finance_payments",
                columns: new[] { "tenant_id", "ReceiptNo" },
                unique: true,
                filter: "\"ReceiptNo\" <> '' AND tenant_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lesson_ledger_entries_DrivingChargeId",
                table: "driving_lesson_ledger_entries",
                column: "DrivingChargeId");

            migrationBuilder.CreateIndex(
                name: "IX_finance_receipt_sequences_Period",
                table: "finance_receipt_sequences",
                column: "Period",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_finance_receipt_sequences_tenant_id",
                table: "finance_receipt_sequences",
                column: "tenant_id");

            migrationBuilder.AddForeignKey(
                name: "FK_driving_lesson_ledger_entries_driving_charges_DrivingCharge~",
                table: "driving_lesson_ledger_entries",
                column: "DrivingChargeId",
                principalTable: "driving_charges",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_driving_lesson_ledger_entries_driving_charges_DrivingCharge~",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropTable(
                name: "finance_receipt_sequences");

            migrationBuilder.DropIndex(
                name: "IX_student_question_threads_StudentUserId",
                table: "student_question_threads");

            migrationBuilder.DropIndex(
                name: "IX_student_question_threads_TeacherUserId",
                table: "student_question_threads");

            migrationBuilder.DropIndex(
                name: "IX_student_question_replies_SenderUserId",
                table: "student_question_replies");

            migrationBuilder.DropIndex(
                name: "IX_message_threads_ParticipantOneUserId",
                table: "message_threads");

            migrationBuilder.DropIndex(
                name: "IX_message_threads_ParticipantTwoUserId",
                table: "message_threads");

            migrationBuilder.DropIndex(
                name: "IX_message_items_SenderUserId",
                table: "message_items");

            migrationBuilder.DropIndex(
                name: "IX_homework_submissions_StudentUserId",
                table: "homework_submissions");

            migrationBuilder.DropIndex(
                name: "IX_finance_payments_tenant_id_ReceiptNo",
                table: "finance_payments");

            migrationBuilder.DropIndex(
                name: "IX_driving_lesson_ledger_entries_DrivingChargeId",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropColumn(
                name: "StudentUserId",
                table: "student_question_threads");

            migrationBuilder.DropColumn(
                name: "TeacherUserId",
                table: "student_question_threads");

            migrationBuilder.DropColumn(
                name: "SenderUserId",
                table: "student_question_replies");

            migrationBuilder.DropColumn(
                name: "ParticipantOneUserId",
                table: "message_threads");

            migrationBuilder.DropColumn(
                name: "ParticipantTwoUserId",
                table: "message_threads");

            migrationBuilder.DropColumn(
                name: "SenderUserId",
                table: "message_items");

            migrationBuilder.DropColumn(
                name: "StudentUserId",
                table: "homework_submissions");

            migrationBuilder.DropColumn(
                name: "DrivingChargeId",
                table: "driving_lesson_ledger_entries");
        }
    }
}
