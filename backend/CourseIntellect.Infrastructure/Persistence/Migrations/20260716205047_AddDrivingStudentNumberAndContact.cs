using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingStudentNumberAndContact : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdentitySerialNo",
                table: "student_driving_profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "student_driving_profiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "StudentNumber",
                table: "student_driving_profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_tenant_id_Phone",
                table: "student_driving_profiles",
                columns: new[] { "tenant_id", "Phone" });

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_tenant_id_StudentNumber",
                table: "student_driving_profiles",
                columns: new[] { "tenant_id", "StudentNumber" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_student_driving_profiles_tenant_id_Phone",
                table: "student_driving_profiles");

            migrationBuilder.DropIndex(
                name: "IX_student_driving_profiles_tenant_id_StudentNumber",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "IdentitySerialNo",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "StudentNumber",
                table: "student_driving_profiles");
        }
    }
}
