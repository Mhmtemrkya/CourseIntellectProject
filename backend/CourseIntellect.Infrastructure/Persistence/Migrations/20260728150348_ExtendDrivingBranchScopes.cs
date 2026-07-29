using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExtendDrivingBranchScopes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "student_driving_documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_vehicle_service_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_vehicle_documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_photo_inspections",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_work_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_transfer_packages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_reconciliations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_reconciliation_rows",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_import_sessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_import_rows",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_history_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_field_progresses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_mebbis_error_occurrences",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_lessons",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_lesson_ledger_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_instructor_working_hours",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_instructor_vehicle_assignments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_instructor_leaves",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_appointment_status_history",
                type: "uuid",
                nullable: true);

            // Mevcut kayıtların şubelerini bağlı oldukları ana kayıtlardan taşır.
            // Birden fazla şubeli kurumda tahmin yapılmaz; yalnız kesin ilişkiler
            // kullanılır. Tek şubeli eski kurumlarda kalan boşluklar güvenle doldurulur.
            migrationBuilder.Sql(
                """
                UPDATE student_driving_documents x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_appointment_status_history x SET branch_id = a.branch_id
                FROM driving_appointments a
                WHERE x."AppointmentId" = a."Id" AND x.branch_id IS NULL;

                UPDATE driving_lessons x SET branch_id = a.branch_id
                FROM driving_appointments a
                WHERE x."AppointmentId" = a."Id" AND x.branch_id IS NULL;

                UPDATE driving_lesson_ledger_entries x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_instructor_vehicle_assignments x SET branch_id = i.branch_id
                FROM driving_instructor_profiles i
                WHERE x."InstructorProfileId" = i."Id" AND x.branch_id IS NULL;

                UPDATE driving_instructor_working_hours x SET branch_id = i.branch_id
                FROM driving_instructor_profiles i
                WHERE x."InstructorProfileId" = i."Id" AND x.branch_id IS NULL;

                UPDATE driving_instructor_leaves x SET branch_id = i.branch_id
                FROM driving_instructor_profiles i
                WHERE x."InstructorProfileId" = i."Id" AND x.branch_id IS NULL;

                UPDATE driving_vehicle_documents x SET branch_id = v.branch_id
                FROM driving_vehicles v
                WHERE x."VehicleId" = v."Id" AND x.branch_id IS NULL;

                UPDATE driving_vehicle_service_records x SET branch_id = v.branch_id
                FROM driving_vehicles v
                WHERE x."VehicleId" = v."Id" AND x.branch_id IS NULL;

                UPDATE driving_photo_inspections x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_history_events x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_field_progresses x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_error_occurrences x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_work_items x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_work_items x SET branch_id = g.branch_id
                FROM driving_student_groups g
                WHERE x."StudentGroupId" = g."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_transfer_packages x SET branch_id = g.branch_id
                FROM driving_student_groups g
                WHERE x."StudentGroupId" = g."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_import_sessions x SET branch_id = g.branch_id
                FROM driving_student_groups g
                WHERE x."StudentGroupId" = g."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_import_rows x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."MatchedStudentProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_import_rows x SET branch_id = s.branch_id
                FROM driving_mebbis_import_sessions s
                WHERE x."ImportSessionId" = s."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_reconciliations x SET branch_id = g.branch_id
                FROM driving_student_groups g
                WHERE x."StudentGroupId" = g."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_reconciliation_rows x SET branch_id = p.branch_id
                FROM student_driving_profiles p
                WHERE x."StudentDrivingProfileId" = p."Id" AND x.branch_id IS NULL;

                UPDATE driving_mebbis_reconciliation_rows x SET branch_id = r.branch_id
                FROM driving_mebbis_reconciliations r
                WHERE x."ReconciliationId" = r."Id" AND x.branch_id IS NULL;

                DO $$
                DECLARE
                    table_name text;
                BEGIN
                    FOREACH table_name IN ARRAY ARRAY[
                        'student_driving_documents',
                        'driving_vehicle_service_records',
                        'driving_vehicle_documents',
                        'driving_photo_inspections',
                        'driving_mebbis_work_items',
                        'driving_mebbis_transfer_packages',
                        'driving_mebbis_reconciliations',
                        'driving_mebbis_reconciliation_rows',
                        'driving_mebbis_import_sessions',
                        'driving_mebbis_import_rows',
                        'driving_mebbis_history_events',
                        'driving_mebbis_field_progresses',
                        'driving_mebbis_error_occurrences',
                        'driving_lessons',
                        'driving_lesson_ledger_entries',
                        'driving_instructor_working_hours',
                        'driving_instructor_vehicle_assignments',
                        'driving_instructor_leaves',
                        'driving_appointment_status_history'
                    ]
                    LOOP
                        EXECUTE format(
                            'UPDATE %I AS target SET branch_id = sole.branch_id
                             FROM (
                                 SELECT tenant_id, (ARRAY_AGG("Id" ORDER BY "Id"))[1] AS branch_id
                                 FROM org_units
                                 WHERE is_active = TRUE
                                   AND LOWER("UnitType") IN (''şube'', ''sube'', ''kampüs'', ''kampus'')
                                 GROUP BY tenant_id
                                 HAVING COUNT(*) = 1
                             ) AS sole
                             WHERE target.tenant_id = sole.tenant_id
                               AND target.branch_id IS NULL',
                            table_name
                        );
                    END LOOP;
                END $$;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_documents_branch_id",
                table: "student_driving_documents",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_service_records_branch_id",
                table: "driving_vehicle_service_records",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicle_documents_branch_id",
                table: "driving_vehicle_documents",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_photo_inspections_branch_id",
                table: "driving_photo_inspections",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_work_items_branch_id",
                table: "driving_mebbis_work_items",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_transfer_packages_branch_id",
                table: "driving_mebbis_transfer_packages",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliations_branch_id",
                table: "driving_mebbis_reconciliations",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_reconciliation_rows_branch_id",
                table: "driving_mebbis_reconciliation_rows",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_sessions_branch_id",
                table: "driving_mebbis_import_sessions",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_import_rows_branch_id",
                table: "driving_mebbis_import_rows",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_history_events_branch_id",
                table: "driving_mebbis_history_events",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_field_progresses_branch_id",
                table: "driving_mebbis_field_progresses",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_error_occurrences_branch_id",
                table: "driving_mebbis_error_occurrences",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lessons_branch_id",
                table: "driving_lessons",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lesson_ledger_entries_branch_id",
                table: "driving_lesson_ledger_entries",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_working_hours_branch_id",
                table: "driving_instructor_working_hours",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_vehicle_assignments_branch_id",
                table: "driving_instructor_vehicle_assignments",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_leaves_branch_id",
                table: "driving_instructor_leaves",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_status_history_branch_id",
                table: "driving_appointment_status_history",
                column: "branch_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_student_driving_documents_branch_id",
                table: "student_driving_documents");

            migrationBuilder.DropIndex(
                name: "IX_driving_vehicle_service_records_branch_id",
                table: "driving_vehicle_service_records");

            migrationBuilder.DropIndex(
                name: "IX_driving_vehicle_documents_branch_id",
                table: "driving_vehicle_documents");

            migrationBuilder.DropIndex(
                name: "IX_driving_photo_inspections_branch_id",
                table: "driving_photo_inspections");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_work_items_branch_id",
                table: "driving_mebbis_work_items");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_transfer_packages_branch_id",
                table: "driving_mebbis_transfer_packages");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_reconciliations_branch_id",
                table: "driving_mebbis_reconciliations");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_reconciliation_rows_branch_id",
                table: "driving_mebbis_reconciliation_rows");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_import_sessions_branch_id",
                table: "driving_mebbis_import_sessions");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_import_rows_branch_id",
                table: "driving_mebbis_import_rows");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_history_events_branch_id",
                table: "driving_mebbis_history_events");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_field_progresses_branch_id",
                table: "driving_mebbis_field_progresses");

            migrationBuilder.DropIndex(
                name: "IX_driving_mebbis_error_occurrences_branch_id",
                table: "driving_mebbis_error_occurrences");

            migrationBuilder.DropIndex(
                name: "IX_driving_lessons_branch_id",
                table: "driving_lessons");

            migrationBuilder.DropIndex(
                name: "IX_driving_lesson_ledger_entries_branch_id",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropIndex(
                name: "IX_driving_instructor_working_hours_branch_id",
                table: "driving_instructor_working_hours");

            migrationBuilder.DropIndex(
                name: "IX_driving_instructor_vehicle_assignments_branch_id",
                table: "driving_instructor_vehicle_assignments");

            migrationBuilder.DropIndex(
                name: "IX_driving_instructor_leaves_branch_id",
                table: "driving_instructor_leaves");

            migrationBuilder.DropIndex(
                name: "IX_driving_appointment_status_history_branch_id",
                table: "driving_appointment_status_history");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "student_driving_documents");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_vehicle_service_records");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_vehicle_documents");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_photo_inspections");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_work_items");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_transfer_packages");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_reconciliations");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_reconciliation_rows");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_import_sessions");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_import_rows");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_history_events");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_field_progresses");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_mebbis_error_occurrences");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_lessons");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_instructor_working_hours");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_instructor_vehicle_assignments");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_instructor_leaves");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_appointment_status_history");
        }
    }
}
