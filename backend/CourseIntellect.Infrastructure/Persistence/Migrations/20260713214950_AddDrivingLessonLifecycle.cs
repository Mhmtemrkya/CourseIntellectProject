using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingLessonLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_lessons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    InstructorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StartKilometer = table.Column<int>(type: "integer", nullable: false),
                    EndKilometer = table.Column<int>(type: "integer", nullable: true),
                    BrakesOk = table.Column<bool>(type: "boolean", nullable: false),
                    TiresOk = table.Column<bool>(type: "boolean", nullable: false),
                    LightsOk = table.Column<bool>(type: "boolean", nullable: false),
                    FluidsOk = table.Column<bool>(type: "boolean", nullable: false),
                    PreCheckNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    InstructorNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    TrafficRulesScore = table.Column<int>(type: "integer", nullable: true),
                    VehicleControlScore = table.Column<int>(type: "integer", nullable: true),
                    ManeuversScore = table.Column<int>(type: "integer", nullable: true),
                    SafetyScore = table.Column<int>(type: "integer", nullable: true),
                    ChargedMinutes = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_lessons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_lessons_driving_appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "driving_appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_lessons_driving_instructor_profiles_InstructorProfi~",
                        column: x => x.InstructorProfileId,
                        principalTable: "driving_instructor_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_lessons_driving_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "driving_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_lessons_student_driving_profiles_StudentDrivingProf~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_lessons_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_lesson_ledger_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    DrivingLessonId = table.Column<Guid>(type: "uuid", nullable: false),
                    MinutesDelta = table.Column<int>(type: "integer", nullable: false),
                    EntryType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_lesson_ledger_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_lesson_ledger_entries_driving_lessons_DrivingLesson~",
                        column: x => x.DrivingLessonId,
                        principalTable: "driving_lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_lesson_ledger_entries_student_driving_profiles_Stud~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_lesson_ledger_entries_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_lesson_ledger_entries_DrivingLessonId",
                table: "driving_lesson_ledger_entries",
                column: "DrivingLessonId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lesson_ledger_entries_StudentDrivingProfileId_Creat~",
                table: "driving_lesson_ledger_entries",
                columns: new[] { "StudentDrivingProfileId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_lesson_ledger_entries_tenant_id",
                table: "driving_lesson_ledger_entries",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lesson_ledger_entries_tenant_id_DrivingLessonId",
                table: "driving_lesson_ledger_entries",
                columns: new[] { "tenant_id", "DrivingLessonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_lessons_AppointmentId",
                table: "driving_lessons",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lessons_InstructorProfileId",
                table: "driving_lessons",
                column: "InstructorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lessons_StudentDrivingProfileId_StartedAtUtc",
                table: "driving_lessons",
                columns: new[] { "StudentDrivingProfileId", "StartedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_lessons_tenant_id",
                table: "driving_lessons",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_lessons_tenant_id_AppointmentId",
                table: "driving_lessons",
                columns: new[] { "tenant_id", "AppointmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_lessons_VehicleId",
                table: "driving_lessons",
                column: "VehicleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_lesson_ledger_entries");

            migrationBuilder.DropTable(
                name: "driving_lessons");
        }
    }
}
