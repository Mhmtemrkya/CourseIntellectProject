using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingStudentResidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ResidenceAddress",
                table: "student_driving_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResidenceAddress",
                table: "student_driving_profiles");
        }
    }
}
