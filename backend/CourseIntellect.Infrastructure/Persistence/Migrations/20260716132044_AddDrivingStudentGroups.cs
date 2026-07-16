using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrivingStudentGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "StudentGroupId",
                table: "student_driving_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "driving_student_groups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driving_student_groups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_driving_student_groups_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_student_driving_profiles_StudentGroupId",
                table: "student_driving_profiles",
                column: "StudentGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_driving_student_groups_tenant_id",
                table: "driving_student_groups",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_driving_student_groups_tenant_id_Name",
                table: "driving_student_groups",
                columns: new[] { "tenant_id", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_student_driving_profiles_driving_student_groups_StudentGrou~",
                table: "student_driving_profiles",
                column: "StudentGroupId",
                principalTable: "driving_student_groups",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_student_driving_profiles_driving_student_groups_StudentGrou~",
                table: "student_driving_profiles");

            migrationBuilder.DropTable(
                name: "driving_student_groups");

            migrationBuilder.DropIndex(
                name: "IX_student_driving_profiles_StudentGroupId",
                table: "student_driving_profiles");

            migrationBuilder.DropColumn(
                name: "StudentGroupId",
                table: "student_driving_profiles");
        }
    }
}
