using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260714123000_AddDrivingLessonDetailedEvaluations")]
public partial class AddDrivingLessonDetailedEvaluations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "evaluation_scores_json",
            table: "driving_lessons",
            type: "jsonb",
            nullable: false,
            defaultValue: "{}");

        migrationBuilder.AddColumn<int>(
            name: "evaluation_version",
            table: "driving_lessons",
            type: "integer",
            nullable: false,
            defaultValue: 0);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "evaluation_scores_json", table: "driving_lessons");
        migrationBuilder.DropColumn(name: "evaluation_version", table: "driving_lessons");
    }
}
