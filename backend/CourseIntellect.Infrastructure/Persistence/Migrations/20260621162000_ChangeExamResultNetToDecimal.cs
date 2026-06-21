using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260621162000_ChangeExamResultNetToDecimal")]
public partial class ChangeExamResultNetToDecimal : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<decimal>(
            name: "Net",
            table: "exam_results",
            type: "numeric(6,2)",
            precision: 6,
            scale: 2,
            nullable: false,
            oldClrType: typeof(int),
            oldType: "integer");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<int>(
            name: "Net",
            table: "exam_results",
            type: "integer",
            nullable: false,
            oldClrType: typeof(decimal),
            oldType: "numeric(6,2)",
            oldPrecision: 6,
            oldScale: 2);
    }
}
