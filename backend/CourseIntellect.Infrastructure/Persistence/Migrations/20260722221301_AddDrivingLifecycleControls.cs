using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingLifecycleControls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutomaticStatusEnabled",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StatusBeforeSuspension",
                table: "student_driving_profiles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StatusChangeReason",
                table: "student_driving_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StatusChangeSource",
                table: "student_driving_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "StatusChangedAtUtc",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StatusChangedByUserId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TrainingOverrideActive",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "TrainingOverrideAtUtc",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TrainingOverrideByUserId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrainingOverrideReason",
                table: "student_driving_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "AutomaticStatusEnabled",
                table: "driving_instructor_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ComplianceOverrideActive",
                table: "driving_instructor_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ComplianceOverrideAtUtc",
                table: "driving_instructor_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ComplianceOverrideByUserId",
                table: "driving_instructor_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ComplianceOverrideReason",
                table: "driving_instructor_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StatusChangeReason",
                table: "driving_instructor_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StatusChangeSource",
                table: "driving_instructor_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "StatusChangedAtUtc",
                table: "driving_instructor_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StatusChangedByUserId",
                table: "driving_instructor_profiles",
                type: "uuid",
                nullable: true);

            // Mevcut kayıtları bir anda otomatik yönetime almak operasyonu kesebilir.
            // Bu nedenle eski kayıtlar manuel/legacy kalır; yeni kayıtlar uygulama
            // katmanında AutomaticStatusEnabled=true ile oluşturulur.
            migrationBuilder.Sql("""
                UPDATE student_driving_profiles
                SET "StatusChangeSource" = 'Legacy',
                    "StatusChangeReason" = 'Yaşam döngüsü özelliğinden önce oluşturulan kayıt.';
                UPDATE driving_instructor_profiles
                SET "StatusChangeSource" = 'Legacy',
                    "StatusChangeReason" = 'Yaşam döngüsü özelliğinden önce oluşturulan kayıt.';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutomaticStatusEnabled",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "StatusBeforeSuspension",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangeReason",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangeSource",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangedAtUtc",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangedByUserId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "TrainingOverrideActive",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "TrainingOverrideAtUtc",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "TrainingOverrideByUserId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "TrainingOverrideReason",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "AutomaticStatusEnabled",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "ComplianceOverrideActive",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "ComplianceOverrideAtUtc",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "ComplianceOverrideByUserId",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "ComplianceOverrideReason",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangeReason",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangeSource",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangedAtUtc",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "StatusChangedByUserId",
                table: "driving_instructor_profiles");
        }
    }
}
