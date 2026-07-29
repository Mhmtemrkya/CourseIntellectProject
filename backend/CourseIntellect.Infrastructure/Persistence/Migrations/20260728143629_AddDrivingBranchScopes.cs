using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingBranchScopes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_vehicles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_theory_sessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_theory_enrollments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_theory_classes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_theory_attendances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_student_groups",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_registration_drafts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_packages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_leads",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_instructor_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_graduation_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_graduation_action_requests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_exam_sessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_exam_commission_members",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_exam_candidates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_charges",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_certificates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "branch_id",
                table: "driving_appointment_requests",
                type: "uuid",
                nullable: true);

            // Mevcut veriyi kaybetmeden şube bilgisini güvenilir üst kayıtlardan
            // devral. Bir kayıt birden fazla şubeyle ilişkiliyse tahmin yapılmaz.
            migrationBuilder.Sql(
                """
                UPDATE student_driving_profiles AS p
                SET branch_id = s.branch_id
                FROM student_profiles AS s
                WHERE p."StudentId" = s."Id"
                  AND p.branch_id IS NULL
                  AND s.branch_id IS NOT NULL;

                UPDATE driving_instructor_profiles AS i
                SET branch_id = s.branch_id
                FROM staff_profiles AS s
                WHERE i."StaffId" = s."Id"
                  AND i.branch_id IS NULL
                  AND s.branch_id IS NOT NULL;

                UPDATE driving_theory_classes AS c
                SET branch_id = s.branch_id
                FROM staff_profiles AS s
                WHERE c."InstructorStaffId" = s."Id"
                  AND c.branch_id IS NULL
                  AND s.branch_id IS NOT NULL;

                UPDATE driving_appointments AS a
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE a."StudentDrivingProfileId" = p."Id"
                  AND a.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_theory_enrollments AS e
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE e."StudentDrivingProfileId" = p."Id"
                  AND e.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_theory_sessions AS s
                SET branch_id = c.branch_id
                FROM driving_theory_classes AS c
                WHERE s."TheoryClassId" = c."Id"
                  AND s.branch_id IS NULL
                  AND c.branch_id IS NOT NULL;

                UPDATE driving_theory_attendances AS a
                SET branch_id = s.branch_id
                FROM driving_theory_sessions AS s
                WHERE a."TheorySessionId" = s."Id"
                  AND a.branch_id IS NULL
                  AND s.branch_id IS NOT NULL;

                UPDATE driving_exam_candidates AS c
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE c."StudentDrivingProfileId" = p."Id"
                  AND c.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_exam_sessions AS s
                SET branch_id = grouped.branch_id
                FROM (
                    SELECT "ExamSessionId", (ARRAY_AGG(branch_id ORDER BY branch_id))[1] AS branch_id
                    FROM driving_exam_candidates
                    WHERE branch_id IS NOT NULL
                    GROUP BY "ExamSessionId"
                    HAVING COUNT(DISTINCT branch_id) = 1
                ) AS grouped
                WHERE s."Id" = grouped."ExamSessionId"
                  AND s.branch_id IS NULL;

                UPDATE driving_exam_commission_members AS m
                SET branch_id = s.branch_id
                FROM driving_exam_sessions AS s
                WHERE m."ExamSessionId" = s."Id"
                  AND m.branch_id IS NULL
                  AND s.branch_id IS NOT NULL;

                UPDATE driving_graduation_records AS g
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE g."StudentDrivingProfileId" = p."Id"
                  AND g.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_certificates AS c
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE c."StudentDrivingProfileId" = p."Id"
                  AND c.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_graduation_action_requests AS r
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE r."StudentDrivingProfileId" = p."Id"
                  AND r.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_appointment_requests AS r
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE r."StudentDrivingProfileId" = p."Id"
                  AND r.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_charges AS c
                SET branch_id = p.branch_id
                FROM student_driving_profiles AS p
                WHERE c."StudentDrivingProfileId" = p."Id"
                  AND c.branch_id IS NULL
                  AND p.branch_id IS NOT NULL;

                UPDATE driving_student_groups AS g
                SET branch_id = grouped.branch_id
                FROM (
                    SELECT "StudentGroupId", (ARRAY_AGG(branch_id ORDER BY branch_id))[1] AS branch_id
                    FROM student_driving_profiles
                    WHERE "StudentGroupId" IS NOT NULL AND branch_id IS NOT NULL
                    GROUP BY "StudentGroupId"
                    HAVING COUNT(DISTINCT branch_id) = 1
                ) AS grouped
                WHERE g."Id" = grouped."StudentGroupId"
                  AND g.branch_id IS NULL;

                UPDATE driving_packages AS p
                SET branch_id = grouped.branch_id
                FROM (
                    SELECT "PackageId", (ARRAY_AGG(branch_id ORDER BY branch_id))[1] AS branch_id
                    FROM student_driving_profiles
                    WHERE branch_id IS NOT NULL
                    GROUP BY "PackageId"
                    HAVING COUNT(DISTINCT branch_id) = 1
                ) AS grouped
                WHERE p."Id" = grouped."PackageId"
                  AND p.branch_id IS NULL;

                UPDATE driving_vehicles AS v
                SET branch_id = grouped.branch_id
                FROM (
                    SELECT "VehicleId", (ARRAY_AGG(branch_id ORDER BY branch_id))[1] AS branch_id
                    FROM driving_appointments
                    WHERE branch_id IS NOT NULL
                    GROUP BY "VehicleId"
                    HAVING COUNT(DISTINCT branch_id) = 1
                ) AS grouped
                WHERE v."Id" = grouped."VehicleId"
                  AND v.branch_id IS NULL;

                -- Kurumda yalnız bir aktif şube varsa kalan eski kayıtların hedefi
                -- kesindir. Çok şubeli kurumlarda NULL bırakılır ve veri tahmin edilmez.
                DO $$
                DECLARE
                    table_name text;
                BEGIN
                    FOREACH table_name IN ARRAY ARRAY[
                        'student_driving_profiles', 'driving_vehicles',
                        'driving_theory_sessions', 'driving_theory_enrollments',
                        'driving_theory_classes', 'driving_theory_attendances',
                        'driving_student_groups', 'driving_registration_drafts',
                        'driving_packages', 'driving_leads',
                        'driving_instructor_profiles', 'driving_graduation_records',
                        'driving_graduation_action_requests', 'driving_exam_sessions',
                        'driving_exam_commission_members', 'driving_exam_candidates',
                        'driving_charges', 'driving_certificates',
                        'driving_appointments', 'driving_appointment_requests'
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
                name: "IX_student_driving_profiles_branch_id",
                table: "student_driving_profiles",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_vehicles_branch_id",
                table: "driving_vehicles",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_theory_sessions_branch_id",
                table: "driving_theory_sessions",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_theory_enrollments_branch_id",
                table: "driving_theory_enrollments",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_theory_classes_branch_id",
                table: "driving_theory_classes",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_theory_attendances_branch_id",
                table: "driving_theory_attendances",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_student_groups_branch_id",
                table: "driving_student_groups",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_registration_drafts_branch_id",
                table: "driving_registration_drafts",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_packages_branch_id",
                table: "driving_packages",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_leads_branch_id",
                table: "driving_leads",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_instructor_profiles_branch_id",
                table: "driving_instructor_profiles",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_graduation_records_branch_id",
                table: "driving_graduation_records",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_graduation_action_requests_branch_id",
                table: "driving_graduation_action_requests",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_exam_sessions_branch_id",
                table: "driving_exam_sessions",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_exam_commission_members_branch_id",
                table: "driving_exam_commission_members",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_exam_candidates_branch_id",
                table: "driving_exam_candidates",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_charges_branch_id",
                table: "driving_charges",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_certificates_branch_id",
                table: "driving_certificates",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointments_branch_id",
                table: "driving_appointments",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_requests_branch_id",
                table: "driving_appointment_requests",
                column: "branch_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_student_driving_profiles_branch_id",
                table: "student_driving_profiles");

            migrationBuilder.DropIndex(
                name: "IX_driving_vehicles_branch_id",
                table: "driving_vehicles");

            migrationBuilder.DropIndex(
                name: "IX_driving_theory_sessions_branch_id",
                table: "driving_theory_sessions");

            migrationBuilder.DropIndex(
                name: "IX_driving_theory_enrollments_branch_id",
                table: "driving_theory_enrollments");

            migrationBuilder.DropIndex(
                name: "IX_driving_theory_classes_branch_id",
                table: "driving_theory_classes");

            migrationBuilder.DropIndex(
                name: "IX_driving_theory_attendances_branch_id",
                table: "driving_theory_attendances");

            migrationBuilder.DropIndex(
                name: "IX_driving_student_groups_branch_id",
                table: "driving_student_groups");

            migrationBuilder.DropIndex(
                name: "IX_driving_registration_drafts_branch_id",
                table: "driving_registration_drafts");

            migrationBuilder.DropIndex(
                name: "IX_driving_packages_branch_id",
                table: "driving_packages");

            migrationBuilder.DropIndex(
                name: "IX_driving_leads_branch_id",
                table: "driving_leads");

            migrationBuilder.DropIndex(
                name: "IX_driving_instructor_profiles_branch_id",
                table: "driving_instructor_profiles");

            migrationBuilder.DropIndex(
                name: "IX_driving_graduation_records_branch_id",
                table: "driving_graduation_records");

            migrationBuilder.DropIndex(
                name: "IX_driving_graduation_action_requests_branch_id",
                table: "driving_graduation_action_requests");

            migrationBuilder.DropIndex(
                name: "IX_driving_exam_sessions_branch_id",
                table: "driving_exam_sessions");

            migrationBuilder.DropIndex(
                name: "IX_driving_exam_commission_members_branch_id",
                table: "driving_exam_commission_members");

            migrationBuilder.DropIndex(
                name: "IX_driving_exam_candidates_branch_id",
                table: "driving_exam_candidates");

            migrationBuilder.DropIndex(
                name: "IX_driving_charges_branch_id",
                table: "driving_charges");

            migrationBuilder.DropIndex(
                name: "IX_driving_certificates_branch_id",
                table: "driving_certificates");

            migrationBuilder.DropIndex(
                name: "IX_driving_appointments_branch_id",
                table: "driving_appointments");

            migrationBuilder.DropIndex(
                name: "IX_driving_appointment_requests_branch_id",
                table: "driving_appointment_requests");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_vehicles");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_theory_sessions");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_theory_enrollments");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_theory_classes");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_theory_attendances");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_student_groups");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_registration_drafts");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_packages");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_leads");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_graduation_records");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_graduation_action_requests");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_exam_sessions");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_exam_commission_members");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_exam_candidates");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_charges");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "branch_id",
                table: "driving_appointment_requests");
        }
    }
}
