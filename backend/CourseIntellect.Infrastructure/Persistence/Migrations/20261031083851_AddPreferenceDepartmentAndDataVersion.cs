using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferenceDepartmentAndDataVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DataVersion",
                table: "preference_programs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Department",
                table: "preference_programs",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            // LGS'de bölüm = okul adı. Gömülü YKS satırları sürüm 0 kaldığı için
            // ilk istekte bölüm ve il bilgisiyle yeniden yüklenir.
            migrationBuilder.Sql("UPDATE preference_programs SET \"Department\" = \"ProgramName\" WHERE \"Exam\" = 'LGS';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DataVersion",
                table: "preference_programs");

            migrationBuilder.DropColumn(
                name: "Department",
                table: "preference_programs");
        }
    }
}
