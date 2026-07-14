using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingGraduationAndAppointmentRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_appointment_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SourceAppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PreferredInstructorProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    PreferredVehicleId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedStartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RequestedEndsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MeetingPoint = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    StudentNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DecisionNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DecidedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DecidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResultAppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_appointment_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_appointment_requests_driving_appointments_ResultApp~",
                        column: x => x.ResultAppointmentId,
                        principalTable: "driving_appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_driving_appointment_requests_driving_appointments_SourceApp~",
                        column: x => x.SourceAppointmentId,
                        principalTable: "driving_appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_driving_appointment_requests_driving_instructor_profiles_Pr~",
                        column: x => x.PreferredInstructorProfileId,
                        principalTable: "driving_instructor_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_driving_appointment_requests_driving_vehicles_PreferredVehi~",
                        column: x => x.PreferredVehicleId,
                        principalTable: "driving_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_driving_appointment_requests_student_driving_profiles_Stude~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_appointment_requests_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_graduation_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ChecklistJson = table.Column<string>(type: "jsonb", nullable: false),
                    CheckedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GraduatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    GraduatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_graduation_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_graduation_records_student_driving_profiles_Student~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_graduation_records_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_certificates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    GraduationRecordId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    CertificateType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DocumentNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IssuedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeliveryStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DeliveredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveredTo = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DeliveryNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_certificates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_certificates_driving_graduation_records_GraduationR~",
                        column: x => x.GraduationRecordId,
                        principalTable: "driving_graduation_records",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_certificates_student_driving_profiles_StudentDrivin~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_certificates_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_requests_PreferredInstructorProfileId",
                table: "driving_appointment_requests",
                column: "PreferredInstructorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_requests_PreferredVehicleId",
                table: "driving_appointment_requests",
                column: "PreferredVehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_requests_ResultAppointmentId",
                table: "driving_appointment_requests",
                column: "ResultAppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_requests_SourceAppointmentId",
                table: "driving_appointment_requests",
                column: "SourceAppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_requests_StudentDrivingProfileId_Status~",
                table: "driving_appointment_requests",
                columns: new[] { "StudentDrivingProfileId", "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_requests_tenant_id",
                table: "driving_appointment_requests",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_certificates_GraduationRecordId",
                table: "driving_certificates",
                column: "GraduationRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_certificates_StudentDrivingProfileId",
                table: "driving_certificates",
                column: "StudentDrivingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_certificates_tenant_id",
                table: "driving_certificates",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_certificates_tenant_id_DocumentNumber",
                table: "driving_certificates",
                columns: new[] { "tenant_id", "DocumentNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_graduation_records_StudentDrivingProfileId",
                table: "driving_graduation_records",
                column: "StudentDrivingProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_graduation_records_tenant_id",
                table: "driving_graduation_records",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_appointment_requests");

            migrationBuilder.DropTable(
                name: "driving_certificates");

            migrationBuilder.DropTable(
                name: "driving_graduation_records");
        }
    }
}
