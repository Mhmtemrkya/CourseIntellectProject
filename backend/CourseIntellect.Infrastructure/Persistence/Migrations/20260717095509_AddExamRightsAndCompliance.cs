using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExamRightsAndCompliance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "FailedPracticeExtraLessonFee",
                table: "driving_school_settings",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "FailedPracticeExtraLessonMinutes",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxVehicleAgeYears",
                table: "driving_school_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "WorkingPermitExpiresAtUtc",
                table: "driving_instructor_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkingPermitNo",
                table: "driving_instructor_profiles",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "AssignedInstructorProfileId",
                table: "driving_exam_candidates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AssignedVehicleId",
                table: "driving_exam_candidates",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_driving_exam_candidates_AssignedInstructorProfileId",
                table: "driving_exam_candidates",
                column: "AssignedInstructorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_exam_candidates_AssignedVehicleId",
                table: "driving_exam_candidates",
                column: "AssignedVehicleId");

            migrationBuilder.AddForeignKey(
                name: "FK_driving_exam_candidates_driving_instructor_profiles_Assigne~",
                table: "driving_exam_candidates",
                column: "AssignedInstructorProfileId",
                principalTable: "driving_instructor_profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_driving_exam_candidates_driving_vehicles_AssignedVehicleId",
                table: "driving_exam_candidates",
                column: "AssignedVehicleId",
                principalTable: "driving_vehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_driving_exam_candidates_driving_instructor_profiles_Assigne~",
                table: "driving_exam_candidates");

            migrationBuilder.DropForeignKey(
                name: "FK_driving_exam_candidates_driving_vehicles_AssignedVehicleId",
                table: "driving_exam_candidates");

            migrationBuilder.DropIndex(
                name: "IX_driving_exam_candidates_AssignedInstructorProfileId",
                table: "driving_exam_candidates");

            migrationBuilder.DropIndex(
                name: "IX_driving_exam_candidates_AssignedVehicleId",
                table: "driving_exam_candidates");

            migrationBuilder.DropColumn(
                name: "FailedPracticeExtraLessonFee",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "FailedPracticeExtraLessonMinutes",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "MaxVehicleAgeYears",
                table: "driving_school_settings");

            migrationBuilder.DropColumn(
                name: "WorkingPermitExpiresAtUtc",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "WorkingPermitNo",
                table: "driving_instructor_profiles");

            migrationBuilder.DropColumn(
                name: "AssignedInstructorProfileId",
                table: "driving_exam_candidates");

            migrationBuilder.DropColumn(
                name: "AssignedVehicleId",
                table: "driving_exam_candidates");
        }
    }
}
