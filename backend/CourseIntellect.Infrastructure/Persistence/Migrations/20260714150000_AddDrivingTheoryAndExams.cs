using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260714150000_AddDrivingTheoryAndExams")]
public partial class AddDrivingTheoryAndExams : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "driving_exam_sessions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false), tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                ExamType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false), Title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                StartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), EndsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                Location = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false), Capacity = table.Column<int>(type: "integer", nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false), CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => { table.PrimaryKey("PK_driving_exam_sessions", x => x.Id); table.ForeignKey("FK_driving_exam_sessions_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });

        migrationBuilder.CreateTable(
            name: "driving_theory_classes",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false), tenant_id = table.Column<Guid>(type: "uuid", nullable: true), Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                LicenseClass = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false), InstructorStaffId = table.Column<Guid>(type: "uuid", nullable: false), Capacity = table.Column<int>(type: "integer", nullable: false),
                StartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), EndsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), Room = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false), CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => { table.PrimaryKey("PK_driving_theory_classes", x => x.Id); table.ForeignKey("FK_driving_theory_classes_staff_profiles_InstructorStaffId", x => x.InstructorStaffId, "staff_profiles", "Id", onDelete: ReferentialAction.Restrict); table.ForeignKey("FK_driving_theory_classes_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });

        migrationBuilder.CreateTable(
            name: "driving_exam_commission_members",
            columns: table => new { Id = table.Column<Guid>(type: "uuid", nullable: false), tenant_id = table.Column<Guid>(type: "uuid", nullable: true), ExamSessionId = table.Column<Guid>(type: "uuid", nullable: false), FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false), Role = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false), Organization = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false) },
            constraints: table => { table.PrimaryKey("PK_driving_exam_commission_members", x => x.Id); table.ForeignKey("FK_driving_exam_commission_members_driving_exam_sessions_ExamSessionId", x => x.ExamSessionId, "driving_exam_sessions", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_exam_commission_members_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });

        migrationBuilder.CreateTable(
            name: "driving_theory_enrollments",
            columns: table => new { Id = table.Column<Guid>(type: "uuid", nullable: false), tenant_id = table.Column<Guid>(type: "uuid", nullable: true), TheoryClassId = table.Column<Guid>(type: "uuid", nullable: false), StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false), EnrolledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false) },
            constraints: table => { table.PrimaryKey("PK_driving_theory_enrollments", x => x.Id); table.ForeignKey("FK_driving_theory_enrollments_driving_theory_classes_TheoryClassId", x => x.TheoryClassId, "driving_theory_classes", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_theory_enrollments_student_driving_profiles_StudentDrivingProfileId", x => x.StudentDrivingProfileId, "student_driving_profiles", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_theory_enrollments_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });

        migrationBuilder.CreateTable(
            name: "driving_theory_sessions",
            columns: table => new { Id = table.Column<Guid>(type: "uuid", nullable: false), tenant_id = table.Column<Guid>(type: "uuid", nullable: true), TheoryClassId = table.Column<Guid>(type: "uuid", nullable: false), InstructorStaffId = table.Column<Guid>(type: "uuid", nullable: false), Subject = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false), Topic = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false), StartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), EndsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), Room = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false), Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false), CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false) },
            constraints: table => { table.PrimaryKey("PK_driving_theory_sessions", x => x.Id); table.ForeignKey("FK_driving_theory_sessions_driving_theory_classes_TheoryClassId", x => x.TheoryClassId, "driving_theory_classes", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_theory_sessions_staff_profiles_InstructorStaffId", x => x.InstructorStaffId, "staff_profiles", "Id", onDelete: ReferentialAction.Restrict); table.ForeignKey("FK_driving_theory_sessions_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });

        migrationBuilder.CreateTable(
            name: "driving_exam_candidates",
            columns: table => new { Id = table.Column<Guid>(type: "uuid", nullable: false), tenant_id = table.Column<Guid>(type: "uuid", nullable: true), ExamSessionId = table.Column<Guid>(type: "uuid", nullable: false), StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false), AttemptNo = table.Column<int>(type: "integer", nullable: false), PreviousCandidateId = table.Column<Guid>(type: "uuid", nullable: true), Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false), Score = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true), FailureReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false), ResultNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false), ResultEnteredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), ResultEnteredByUserId = table.Column<Guid>(type: "uuid", nullable: true), DrivingChargeId = table.Column<Guid>(type: "uuid", nullable: true), CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false) },
            constraints: table => { table.PrimaryKey("PK_driving_exam_candidates", x => x.Id); table.ForeignKey("FK_driving_exam_candidates_driving_charges_DrivingChargeId", x => x.DrivingChargeId, "driving_charges", "Id", onDelete: ReferentialAction.SetNull); table.ForeignKey("FK_driving_exam_candidates_driving_exam_candidates_PreviousCandidateId", x => x.PreviousCandidateId, "driving_exam_candidates", "Id", onDelete: ReferentialAction.Restrict); table.ForeignKey("FK_driving_exam_candidates_driving_exam_sessions_ExamSessionId", x => x.ExamSessionId, "driving_exam_sessions", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_exam_candidates_student_driving_profiles_StudentDrivingProfileId", x => x.StudentDrivingProfileId, "student_driving_profiles", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_exam_candidates_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });

        migrationBuilder.CreateTable(
            name: "driving_theory_attendances",
            columns: table => new { Id = table.Column<Guid>(type: "uuid", nullable: false), tenant_id = table.Column<Guid>(type: "uuid", nullable: true), TheorySessionId = table.Column<Guid>(type: "uuid", nullable: false), StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false), Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false), Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false), MarkedByUserId = table.Column<Guid>(type: "uuid", nullable: true), MarkedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false) },
            constraints: table => { table.PrimaryKey("PK_driving_theory_attendances", x => x.Id); table.ForeignKey("FK_driving_theory_attendances_driving_theory_sessions_TheorySessionId", x => x.TheorySessionId, "driving_theory_sessions", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_theory_attendances_student_driving_profiles_StudentDrivingProfileId", x => x.StudentDrivingProfileId, "student_driving_profiles", "Id", onDelete: ReferentialAction.Cascade); table.ForeignKey("FK_driving_theory_attendances_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });

        migrationBuilder.CreateIndex("IX_driving_exam_sessions_tenant_id", "driving_exam_sessions", "tenant_id"); migrationBuilder.CreateIndex("IX_driving_exam_sessions_ExamType_StartsAtUtc", "driving_exam_sessions", new[] { "ExamType", "StartsAtUtc" });
        migrationBuilder.CreateIndex("IX_driving_theory_classes_tenant_id", "driving_theory_classes", "tenant_id"); migrationBuilder.CreateIndex("IX_driving_theory_classes_InstructorStaffId_StartsAtUtc", "driving_theory_classes", new[] { "InstructorStaffId", "StartsAtUtc" });
        migrationBuilder.CreateIndex("IX_driving_exam_commission_members_tenant_id", "driving_exam_commission_members", "tenant_id"); migrationBuilder.CreateIndex("IX_driving_exam_commission_members_ExamSessionId", "driving_exam_commission_members", "ExamSessionId");
        migrationBuilder.CreateIndex("IX_driving_theory_enrollments_tenant_id", "driving_theory_enrollments", "tenant_id"); migrationBuilder.CreateIndex("IX_driving_theory_enrollments_StudentDrivingProfileId", "driving_theory_enrollments", "StudentDrivingProfileId"); migrationBuilder.CreateIndex("IX_driving_theory_enrollments_TheoryClassId_StudentDrivingProfileId", "driving_theory_enrollments", new[] { "TheoryClassId", "StudentDrivingProfileId" }, unique: true);
        migrationBuilder.CreateIndex("IX_driving_theory_sessions_tenant_id", "driving_theory_sessions", "tenant_id"); migrationBuilder.CreateIndex("IX_driving_theory_sessions_TheoryClassId_StartsAtUtc", "driving_theory_sessions", new[] { "TheoryClassId", "StartsAtUtc" }); migrationBuilder.CreateIndex("IX_driving_theory_sessions_InstructorStaffId_StartsAtUtc", "driving_theory_sessions", new[] { "InstructorStaffId", "StartsAtUtc" });
        migrationBuilder.CreateIndex("IX_driving_exam_candidates_tenant_id", "driving_exam_candidates", "tenant_id"); migrationBuilder.CreateIndex("IX_driving_exam_candidates_DrivingChargeId", "driving_exam_candidates", "DrivingChargeId"); migrationBuilder.CreateIndex("IX_driving_exam_candidates_PreviousCandidateId", "driving_exam_candidates", "PreviousCandidateId"); migrationBuilder.CreateIndex("IX_driving_exam_candidates_StudentDrivingProfileId_AttemptNo", "driving_exam_candidates", new[] { "StudentDrivingProfileId", "AttemptNo" }); migrationBuilder.CreateIndex("IX_driving_exam_candidates_ExamSessionId_StudentDrivingProfileId", "driving_exam_candidates", new[] { "ExamSessionId", "StudentDrivingProfileId" }, unique: true);
        migrationBuilder.CreateIndex("IX_driving_theory_attendances_tenant_id", "driving_theory_attendances", "tenant_id"); migrationBuilder.CreateIndex("IX_driving_theory_attendances_StudentDrivingProfileId", "driving_theory_attendances", "StudentDrivingProfileId"); migrationBuilder.CreateIndex("IX_driving_theory_attendances_TheorySessionId_StudentDrivingProfileId", "driving_theory_attendances", new[] { "TheorySessionId", "StudentDrivingProfileId" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("driving_exam_commission_members"); migrationBuilder.DropTable("driving_exam_candidates"); migrationBuilder.DropTable("driving_theory_attendances"); migrationBuilder.DropTable("driving_exam_sessions"); migrationBuilder.DropTable("driving_theory_enrollments"); migrationBuilder.DropTable("driving_theory_sessions"); migrationBuilder.DropTable("driving_theory_classes");
    }
}
