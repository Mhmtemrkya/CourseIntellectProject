using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferenceRobot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "preference_programs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Exam = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InstitutionType = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    InstitutionName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    City = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Unit = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    ProgramName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ScoreType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Quota = table.Column<int>(type: "integer", nullable: true),
                    Placed = table.Column<int>(type: "integer", nullable: true),
                    MinScore = table.Column<decimal>(type: "numeric(9,5)", precision: 9, scale: 5, nullable: true),
                    MaxScore = table.Column<decimal>(type: "numeric(9,5)", precision: 9, scale: 5, nullable: true),
                    Percentile = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: true),
                    Source = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SourceUrl = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ImportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_preference_programs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "student_preference_choices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Exam = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    ProgramCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_preference_choices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_preference_choices_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_preference_programs_Exam_Year_Code",
                table: "preference_programs",
                columns: new[] { "Exam", "Year", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_preference_programs_Exam_Year_ScoreType_MinScore",
                table: "preference_programs",
                columns: new[] { "Exam", "Year", "ScoreType", "MinScore" });

            migrationBuilder.CreateIndex(
                name: "IX_student_preference_choices_branch_id",
                table: "student_preference_choices",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_student_preference_choices_StudentUserId_Exam_ProgramCode",
                table: "student_preference_choices",
                columns: new[] { "StudentUserId", "Exam", "ProgramCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_student_preference_choices_tenant_id",
                table: "student_preference_choices",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "preference_programs");

            migrationBuilder.DropTable(
                name: "student_preference_choices");
        }
    }
}
