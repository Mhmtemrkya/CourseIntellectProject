using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSubjectGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "subject_group_members",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    SubjectGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    TeacherUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TeacherName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    JoinedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subject_group_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subject_group_members_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "subject_groups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    Subject = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    AcademicYear = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    HeadTeacherUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    HeadTeacherName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Color = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subject_groups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subject_groups_tenant_workspaces_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenant_workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_subject_group_members_branch_id",
                table: "subject_group_members",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_subject_group_members_SubjectGroupId_TeacherUserId",
                table: "subject_group_members",
                columns: new[] { "SubjectGroupId", "TeacherUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subject_group_members_TeacherUserId",
                table: "subject_group_members",
                column: "TeacherUserId");

            migrationBuilder.CreateIndex(
                name: "IX_subject_group_members_tenant_id",
                table: "subject_group_members",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_subject_groups_branch_id",
                table: "subject_groups",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "IX_subject_groups_tenant_id",
                table: "subject_groups",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_subject_groups_tenant_id_branch_id_Subject_AcademicYear",
                table: "subject_groups",
                columns: new[] { "tenant_id", "branch_id", "Subject", "AcademicYear" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "subject_group_members");

            migrationBuilder.DropTable(
                name: "subject_groups");
        }
    }
}
