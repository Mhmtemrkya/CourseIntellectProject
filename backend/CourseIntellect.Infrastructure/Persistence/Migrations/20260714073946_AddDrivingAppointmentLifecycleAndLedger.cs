using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingAppointmentLifecycleAndLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "DrivingLessonId",
                table: "driving_lesson_ledger_entries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "AppointmentId",
                table: "driving_lesson_ledger_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "driving_lesson_ledger_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "driving_lesson_ledger_entries",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "driving_appointments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAtUtc",
                table: "driving_appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CancelledByUserId",
                table: "driving_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckedInAtUtc",
                table: "driving_appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "driving_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MeetingPoint",
                table: "driving_appointments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "RescheduledFromAppointmentId",
                table: "driving_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RescheduledToAppointmentId",
                table: "driving_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "driving_appointment_status_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ToStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ChangedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_appointment_status_history", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_appointment_status_history_driving_appointments_App~",
                        column: x => x.AppointmentId,
                        principalTable: "driving_appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_appointment_status_history_tenant_workspaces_tenant~",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "driving_school_settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    LateCancellationHours = table.Column<int>(type: "integer", nullable: false),
                    LateCancellationDeductPercent = table.Column<int>(type: "integer", nullable: false),
                    NoShowDeductPercent = table.Column<int>(type: "integer", nullable: false),
                    RequireApprovalForStudentRequests = table.Column<bool>(type: "boolean", nullable: false),
                    MinRescheduleHours = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_school_settings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_school_settings_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_lesson_ledger_entries_AppointmentId",
                table: "driving_lesson_ledger_entries",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_status_history_AppointmentId_CreatedAtU~",
                table: "driving_appointment_status_history",
                columns: new[] { "AppointmentId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_appointment_status_history_tenant_id",
                table: "driving_appointment_status_history",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_school_settings_tenant_id",
                table: "driving_school_settings",
                column: "tenant_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_driving_lesson_ledger_entries_driving_appointments_Appointm~",
                table: "driving_lesson_ledger_entries",
                column: "AppointmentId",
                principalTable: "driving_appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Ders hakkı artık defterden hesaplanıyor. Mevcut kursiyerlerin bakiyesi
            // sıfır görünmesin diye açılış hareketlerini geriye dönük yazıyoruz:
            //   1) paketten gelen hak,
            //   2) hâlâ takvimde yer tutan randevuların rezervasyonu.
            // (Gerçekleşen dersler zaten LessonUsage satırı olarak defterde.)
            migrationBuilder.Sql("""
                INSERT INTO driving_lesson_ledger_entries
                    ("Id", tenant_id, "StudentDrivingProfileId", "DrivingLessonId", "AppointmentId",
                     "MinutesDelta", "EntryType", "Description", "Reason", "CreatedByUserId", "CreatedAtUtc")
                SELECT gen_random_uuid(), p.tenant_id, p."Id", NULL, NULL,
                       p."PurchasedDrivingMinutes", 'PackageMinutes', 'Paketten gelen direksiyon hakkı (geriye dönük)', '', NULL, NOW() AT TIME ZONE 'utc'
                FROM student_driving_profiles p
                WHERE p."PurchasedDrivingMinutes" > 0
                  AND NOT EXISTS (
                      SELECT 1 FROM driving_lesson_ledger_entries l
                      WHERE l."StudentDrivingProfileId" = p."Id" AND l."EntryType" = 'PackageMinutes');
                """);

            migrationBuilder.Sql("""
                INSERT INTO driving_lesson_ledger_entries
                    ("Id", tenant_id, "StudentDrivingProfileId", "DrivingLessonId", "AppointmentId",
                     "MinutesDelta", "EntryType", "Description", "Reason", "CreatedByUserId", "CreatedAtUtc")
                SELECT gen_random_uuid(), a.tenant_id, a."StudentDrivingProfileId", NULL, a."Id",
                       -CAST(EXTRACT(EPOCH FROM (a."EndsAtUtc" - a."StartsAtUtc")) / 60 AS integer),
                       'PlannedMinutes', 'Açık randevu rezervasyonu (geriye dönük)', '', NULL, NOW() AT TIME ZONE 'utc'
                FROM driving_appointments a
                WHERE a."Status" IN ('Planned', 'Approved', 'InProgress')
                  AND NOT EXISTS (
                      SELECT 1 FROM driving_lesson_ledger_entries l
                      WHERE l."AppointmentId" = a."Id" AND l."EntryType" = 'PlannedMinutes');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_driving_lesson_ledger_entries_driving_appointments_Appointm~",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropTable(
                name: "driving_appointment_status_history");

            migrationBuilder.DropTable(
                name: "driving_school_settings");

            migrationBuilder.DropIndex(
                name: "IX_driving_lesson_ledger_entries_AppointmentId",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropColumn(
                name: "AppointmentId",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropColumn(
                name: "Reason",
                table: "driving_lesson_ledger_entries");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "CancelledByUserId",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "CheckedInAtUtc",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "MeetingPoint",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "RescheduledFromAppointmentId",
                table: "driving_appointments");

            migrationBuilder.DropColumn(
                name: "RescheduledToAppointmentId",
                table: "driving_appointments");

            migrationBuilder.AlterColumn<Guid>(
                name: "DrivingLessonId",
                table: "driving_lesson_ledger_entries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
