using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingStudentRegistrationAndDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccessibilityNotes",
                table: "student_driving_profiles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAtUtc",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AvailableWeekdays",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AvailableWeekend",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "BloodType",
                table: "student_driving_profiles",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "student_driving_profiles",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "CommunicationConsent",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ContractSignedAtUtc",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CourseStartsAtUtc",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "student_driving_profiles",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DrivingExperience",
                table: "student_driving_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EducationLevel",
                table: "student_driving_profiles",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "student_driving_profiles",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "student_driving_profiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "EnrollmentContractId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "student_driving_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityKind",
                table: "student_driving_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityNumber",
                table: "student_driving_profiles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "KvkkConsentAtUtc",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Nationality",
                table: "student_driving_profiles",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Occupation",
                table: "student_driving_profiles",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "student_driving_profiles",
                type: "character varying(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "PreferredInstructorProfileId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PreferredVehicleId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PrefersEvening",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PrefersMidday",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PrefersMorning",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "RegisteredByUserId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignatureUrl",
                table: "student_driving_profiles",
                type: "character varying(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppPhone",
                table: "student_driving_profiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "driving_registration_drafts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Step = table.Column<int>(type: "integer", nullable: false),
                    PayloadJson = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_registration_drafts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_registration_drafts_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "student_driving_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DocumentNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UploadedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsCurrent = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_driving_documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_driving_documents_student_driving_profiles_StudentD~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_student_driving_documents_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_tenant_id_Status",
                table: "student_driving_profiles",
                columns: new[] { "tenant_id", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_registration_drafts_tenant_id",
                table: "driving_registration_drafts",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_registration_drafts_tenant_id_CreatedByUserId_Updat~",
                table: "driving_registration_drafts",
                columns: new[] { "tenant_id", "CreatedByUserId", "UpdatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_documents_StudentDrivingProfileId_DocumentT~",
                table: "student_driving_documents",
                columns: new[] { "StudentDrivingProfileId", "DocumentType", "IsCurrent" });

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_documents_tenant_id",
                table: "student_driving_documents",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_registration_drafts");

            migrationBuilder.DropTable(
                name: "student_driving_documents");

            migrationBuilder.DropIndex(
                name: "IX_student_driving_profiles_tenant_id_Status",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "AccessibilityNotes",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "ApprovedAtUtc",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "AvailableWeekdays",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "AvailableWeekend",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "BloodType",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "City",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "CommunicationConsent",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "ContractSignedAtUtc",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "CourseStartsAtUtc",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "District",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "DrivingExperience",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "EducationLevel",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "EmergencyContactName",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "EmergencyContactPhone",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "EnrollmentContractId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "IdentityKind",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "IdentityNumber",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "KvkkConsentAtUtc",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "Nationality",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "Occupation",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "PreferredInstructorProfileId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "PreferredVehicleId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "PrefersEvening",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "PrefersMidday",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "PrefersMorning",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "RegisteredByUserId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "SignatureUrl",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "WhatsAppPhone",
                table: "student_driving_profiles");
        }
    }
}
