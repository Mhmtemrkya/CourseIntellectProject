using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingStudentLicenseAndLivePhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExistingLicenseClasses",
                table: "student_driving_profiles",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExistingLicenseNumber",
                table: "student_driving_profiles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "HasExistingLicense",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LicenseExpiryDate",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LicenseIssueDate",
                table: "student_driving_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LicenseIssuePlace",
                table: "student_driving_profiles",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LivePhotoUrl",
                table: "student_driving_profiles",
                type: "character varying(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExistingLicenseClasses",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "ExistingLicenseNumber",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "HasExistingLicense",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "LicenseExpiryDate",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "LicenseIssueDate",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "LicenseIssuePlace",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "LivePhotoUrl",
                table: "student_driving_profiles");
        }
    }
}
