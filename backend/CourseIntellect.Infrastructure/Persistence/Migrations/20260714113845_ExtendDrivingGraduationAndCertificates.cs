using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExtendDrivingGraduationAndCertificates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CertificateDirectorName",
                table: "driving_school_settings",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CertificateDirectorTitle",
                table: "driving_school_settings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "Kurum Müdürü");

            migrationBuilder.AddColumn<string>(
                name: "CertificateLogoUrl",
                table: "driving_school_settings",
                type: "character varying(700)",
                maxLength: 700,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CertificatePrimaryColor",
                table: "driving_school_settings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "#173B57");

            migrationBuilder.AddColumn<string>(
                name: "CertificateSignatureUrl",
                table: "driving_school_settings",
                type: "character varying(700)",
                maxLength: 700,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExcusedAbsencePolicy",
                table: "driving_school_settings",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "ExcludeFromCalculation");

            migrationBuilder.AddColumn<decimal>(
                name: "MinimumTheoryAttendancePercent",
                table: "driving_school_settings",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 80m);

            migrationBuilder.AddColumn<string>(
                name: "RevocationReason",
                table: "driving_graduation_records",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RevokedAtUtc",
                table: "driving_graduation_records",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RevokedByUserId",
                table: "driving_graduation_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PdfFileUrl",
                table: "driving_certificates",
                type: "character varying(700)",
                maxLength: 700,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReissueReason",
                table: "driving_certificates",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ReissuedFromCertificateId",
                table: "driving_certificates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RevocationReason",
                table: "driving_certificates",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RevokedAtUtc",
                table: "driving_certificates",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RevokedByUserId",
                table: "driving_certificates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SnapshotJson",
                table: "driving_certificates",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "driving_certificates",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.AddColumn<string>(
                name: "VerificationTokenHash",
                table: "driving_certificates",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "driving_certificates",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "driving_graduation_action_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    GraduationRecordId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActionType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    RequestedChecklistKeysJson = table.Column<string>(type: "jsonb", nullable: false),
                    Reason = table.Column<string>(type: "character varying(1500)", maxLength: 1500, nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FirstApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    FirstApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SecondApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    SecondApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RejectedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecisionNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    AppliedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_graduation_action_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_graduation_action_requests_driving_graduation_recor~",
                        column: x => x.GraduationRecordId,
                        principalTable: "driving_graduation_records",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_driving_graduation_action_requests_student_driving_profiles~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_graduation_action_requests_tenant_workspaces_tenant~",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            // Eski belgeler için de tekil, tahmin edilemez doğrulama özeti üret.
            // Ham anahtar geçmişte bulunmadığından bu belgeler ilk indirmede yeni
            // QR anahtarı ve kalıcı PDF ile güvenli biçimde yenilenir.
            migrationBuilder.Sql("""
                UPDATE driving_certificates
                SET "VerificationTokenHash" = upper(md5(random()::text || "Id"::text) || md5(clock_timestamp()::text || "Id"::text))
                WHERE "VerificationTokenHash" = '';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_driving_certificates_ReissuedFromCertificateId",
                table: "driving_certificates",
                column: "ReissuedFromCertificateId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_certificates_VerificationTokenHash",
                table: "driving_certificates",
                column: "VerificationTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_graduation_action_requests_GraduationRecordId",
                table: "driving_graduation_action_requests",
                column: "GraduationRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_graduation_action_requests_StudentDrivingProfileId_~",
                table: "driving_graduation_action_requests",
                columns: new[] { "StudentDrivingProfileId", "Status", "RequestedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_graduation_action_requests_tenant_id",
                table: "driving_graduation_action_requests",
                column: "tenant_id");

            migrationBuilder.AddForeignKey(
                name: "FK_driving_certificates_driving_certificates_ReissuedFromCerti~",
                table: "driving_certificates",
                column: "ReissuedFromCertificateId",
                principalTable: "driving_certificates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_driving_certificates_driving_certificates_ReissuedFromCerti~",
                table: "driving_certificates");

            migrationBuilder.DropTable(
                name: "driving_graduation_action_requests");

            migrationBuilder.DropIndex(
                name: "IX_driving_certificates_ReissuedFromCertificateId",
                table: "driving_certificates");

            migrationBuilder.DropIndex(
                name: "IX_driving_certificates_VerificationTokenHash",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "CertificateDirectorName",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "CertificateDirectorTitle",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "CertificateLogoUrl",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "CertificatePrimaryColor",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "CertificateSignatureUrl",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "ExcusedAbsencePolicy",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "MinimumTheoryAttendancePercent",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "RevocationReason",
                table: "driving_graduation_records");

            migrationBuilder.DropColumn(
                name: "RevokedAtUtc",
                table: "driving_graduation_records");

            migrationBuilder.DropColumn(
                name: "RevokedByUserId",
                table: "driving_graduation_records");

            migrationBuilder.DropColumn(
                name: "PdfFileUrl",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "ReissueReason",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "ReissuedFromCertificateId",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "RevocationReason",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "RevokedAtUtc",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "RevokedByUserId",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "SnapshotJson",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "VerificationTokenHash",
                table: "driving_certificates");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "driving_certificates");
        }
    }
}
