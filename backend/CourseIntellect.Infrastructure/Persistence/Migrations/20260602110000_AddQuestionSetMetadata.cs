using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260602110000_AddQuestionSetMetadata")]
public partial class AddQuestionSetMetadata : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "question_order",
            table: "question_bank_items",
            type: "integer",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "question_set_key",
            table: "question_bank_items",
            type: "character varying(120)",
            maxLength: 120,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "question_set_title",
            table: "question_bank_items",
            type: "character varying(240)",
            maxLength: 240,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_question_bank_items_question_set_key_question_order",
            table: "question_bank_items",
            columns: new[] { "question_set_key", "question_order" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_question_bank_items_question_set_key_question_order",
            table: "question_bank_items");

        migrationBuilder.DropColumn(
            name: "question_order",
            table: "question_bank_items");

        migrationBuilder.DropColumn(
            name: "question_set_key",
            table: "question_bank_items");

        migrationBuilder.DropColumn(
            name: "question_set_title",
            table: "question_bank_items");
    }
}
