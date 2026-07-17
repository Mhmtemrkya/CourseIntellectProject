using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMebbisAlignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BirthPlace",
                table: "student_driving_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FatherName",
                table: "student_driving_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MotherName",
                table: "student_driving_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "IssuedAtUtc",
                table: "student_driving_documents",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IssuedBy",
                table: "student_driving_documents",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MebbisTermCode",
                table: "driving_student_groups",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Quota",
                table: "driving_student_groups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "RegistrationDeadlineUtc",
                table: "driving_student_groups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TermNumber",
                table: "driving_student_groups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TermYear",
                table: "driving_student_groups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LessonEarliestHour",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LessonLatestHour",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxStudentDailyMinutes",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_driving_student_groups_tenant_id_TermYear_TermNumber",
                table: "driving_student_groups",
                columns: new[] { "tenant_id", "TermYear", "TermNumber" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_driving_student_groups_tenant_id_TermYear_TermNumber",
                table: "driving_student_groups");

            migrationBuilder.DropColumn(
                name: "BirthPlace",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "FatherName",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "MotherName",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "IssuedAtUtc",
                table: "student_driving_documents");

            migrationBuilder.DropColumn(
                name: "IssuedBy",
                table: "student_driving_documents");

            migrationBuilder.DropColumn(
                name: "MebbisTermCode",
                table: "driving_student_groups");

            migrationBuilder.DropColumn(
                name: "Quota",
                table: "driving_student_groups");

            migrationBuilder.DropColumn(
                name: "RegistrationDeadlineUtc",
                table: "driving_student_groups");

            migrationBuilder.DropColumn(
                name: "TermNumber",
                table: "driving_student_groups");

            migrationBuilder.DropColumn(
                name: "TermYear",
                table: "driving_student_groups");

            migrationBuilder.DropColumn(
                name: "LessonEarliestHour",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "LessonLatestHour",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "MaxStudentDailyMinutes",
                table: "driving_school_settings");
        }
    }
}
