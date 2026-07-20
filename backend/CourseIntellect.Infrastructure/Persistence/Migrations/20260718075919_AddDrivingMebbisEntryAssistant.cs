using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingMebbisEntryAssistant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "driving_mebbis_field_progresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    FieldKey = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_mebbis_field_progresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_field_progresses_student_driving_profiles_St~",
                        column: x => x.StudentDrivingProfileId,
                        principalTable: "student_driving_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_driving_mebbis_field_progresses_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_field_progresses_StudentDrivingProfileId",
                table: "driving_mebbis_field_progresses",
                column: "StudentDrivingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_field_progresses_tenant_id",
                table: "driving_mebbis_field_progresses",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_field_progresses_tenant_id_StudentDrivingPr~1",
                table: "driving_mebbis_field_progresses",
                columns: new[] { "tenant_id", "StudentDrivingProfileId", "IsCompleted" });

            migrationBuilder.CreateIndex(
                name: "IX_driving_mebbis_field_progresses_tenant_id_StudentDrivingPro~",
                table: "driving_mebbis_field_progresses",
                columns: new[] { "tenant_id", "StudentDrivingProfileId", "FieldKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driving_mebbis_field_progresses");
        }
    }
}
