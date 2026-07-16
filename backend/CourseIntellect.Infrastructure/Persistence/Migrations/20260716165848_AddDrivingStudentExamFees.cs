using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingStudentExamFees : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DrivingExamFee",
                table: "student_driving_profiles",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "DrivingExamFeePaid",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "TheoryExamFee",
                table: "student_driving_profiles",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "TheoryExamFeePaid",
                table: "student_driving_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DrivingExamFee",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "DrivingExamFeePaid",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "TheoryExamFee",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "TheoryExamFeePaid",
                table: "student_driving_profiles");
        }
    }
}
