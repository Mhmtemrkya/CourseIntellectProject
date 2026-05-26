using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260525181500_ExpandQuestionStudioContent")]
public partial class ExpandQuestionStudioContent : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "rich_text_html",
            table: "question_bank_items",
            type: "character varying(16000)",
            maxLength: 16000,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "solution_text_html",
            table: "question_bank_items",
            type: "character varying(16000)",
            maxLength: 16000,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "editor_metadata_json",
            table: "question_bank_items",
            type: "character varying(30000)",
            maxLength: 30000,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "publication_status",
            table: "question_bank_items",
            type: "character varying(30)",
            maxLength: 30,
            nullable: false,
            defaultValue: "Published");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "rich_text_html", table: "question_bank_items");
        migrationBuilder.DropColumn(name: "solution_text_html", table: "question_bank_items");
        migrationBuilder.DropColumn(name: "editor_metadata_json", table: "question_bank_items");
        migrationBuilder.DropColumn(name: "publication_status", table: "question_bank_items");
    }
}
