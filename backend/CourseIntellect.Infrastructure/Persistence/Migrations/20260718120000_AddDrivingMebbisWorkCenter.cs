using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260718120000_AddDrivingMebbisWorkCenter")]
public partial class AddDrivingMebbisWorkCenter : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "driving_mebbis_work_items",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                WorkType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                SubjectId = table.Column<Guid>(type: "uuid", nullable: false),
                StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                StudentGroupId = table.Column<Guid>(type: "uuid", nullable: true),
                Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                ErrorReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                AssignedToUserId = table.Column<Guid>(type: "uuid", nullable: true),
                LastChangedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                EnteredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                VerifiedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                DueAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                Version = table.Column<int>(type: "integer", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_driving_mebbis_work_items", x => x.Id);
                table.ForeignKey("FK_driving_mebbis_work_items_driving_student_groups_StudentGr~", x => x.StudentGroupId, "driving_student_groups", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_driving_mebbis_work_items_student_driving_profiles_StudentD~", x => x.StudentDrivingProfileId, "student_driving_profiles", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_driving_mebbis_work_items_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex("IX_driving_mebbis_work_items_StudentDrivingProfileId", "driving_mebbis_work_items", "StudentDrivingProfileId");
        migrationBuilder.CreateIndex("IX_driving_mebbis_work_items_StudentGroupId", "driving_mebbis_work_items", "StudentGroupId");
        migrationBuilder.CreateIndex("IX_driving_mebbis_work_items_tenant_id", "driving_mebbis_work_items", "tenant_id");
        migrationBuilder.CreateIndex("IX_driving_mebbis_work_items_tenant_id_Status_DueAtUtc", "driving_mebbis_work_items", new[] { "tenant_id", "Status", "DueAtUtc" });
        migrationBuilder.CreateIndex("IX_driving_mebbis_work_items_tenant_id_WorkType_SubjectId", "driving_mebbis_work_items", new[] { "tenant_id", "WorkType", "SubjectId" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropTable(name: "driving_mebbis_work_items");
}
