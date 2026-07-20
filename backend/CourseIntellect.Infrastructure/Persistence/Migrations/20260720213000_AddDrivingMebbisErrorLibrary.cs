using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260720213000_AddDrivingMebbisErrorLibrary")]
public sealed class AddDrivingMebbisErrorLibrary : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.CreateTable(name: "driving_mebbis_error_definitions", columns: t => new
        {
            Id = t.Column<Guid>(type: "uuid", nullable: false), tenant_id = t.Column<Guid>(type: "uuid", nullable: true),
            Code = t.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false), Title = t.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
            Description = t.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false), PossibleCause = t.Column<string>(type: "character varying(1500)", maxLength: 1500, nullable: false),
            ResolutionStepsJson = t.Column<string>(type: "jsonb", nullable: false), Severity = t.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
            IsSystem = t.Column<bool>(type: "boolean", nullable: false), IsActive = t.Column<bool>(type: "boolean", nullable: false), Version = t.Column<int>(type: "integer", nullable: false),
            CreatedByUserId = t.Column<Guid>(type: "uuid", nullable: false), UpdatedByUserId = t.Column<Guid>(type: "uuid", nullable: true), CreatedAtUtc = t.Column<DateTime>(type: "timestamp with time zone", nullable: false), UpdatedAtUtc = t.Column<DateTime>(type: "timestamp with time zone", nullable: false)
        }, constraints: t => { t.PrimaryKey("PK_driving_mebbis_error_definitions", x => x.Id); t.ForeignKey("FK_driving_mebbis_error_definitions_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });
        m.CreateTable(name: "driving_mebbis_error_occurrences", columns: t => new
        {
            Id = t.Column<Guid>(type: "uuid", nullable: false), tenant_id = t.Column<Guid>(type: "uuid", nullable: true), ErrorDefinitionId = t.Column<Guid>(type: "uuid", nullable: false), StudentDrivingProfileId = t.Column<Guid>(type: "uuid", nullable: true),
            SourceType = t.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false), SourceId = t.Column<Guid>(type: "uuid", nullable: true), Note = t.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
            OccurredAtUtc = t.Column<DateTime>(type: "timestamp with time zone", nullable: false), ReportedByUserId = t.Column<Guid>(type: "uuid", nullable: false), ReportedByName = t.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
            ResolvedAtUtc = t.Column<DateTime>(type: "timestamp with time zone", nullable: true), ResolvedByUserId = t.Column<Guid>(type: "uuid", nullable: true), ResolutionNote = t.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false), Version = t.Column<int>(type: "integer", nullable: false)
        }, constraints: t => { t.PrimaryKey("PK_driving_mebbis_error_occurrences", x => x.Id); t.ForeignKey("FK_driving_mebbis_error_occurrences_driving_mebbis_error_defin~", x => x.ErrorDefinitionId, "driving_mebbis_error_definitions", "Id", onDelete: ReferentialAction.Restrict); t.ForeignKey("FK_driving_mebbis_error_occurrences_student_driving_profiles_St~", x => x.StudentDrivingProfileId, "student_driving_profiles", "Id", onDelete: ReferentialAction.SetNull); t.ForeignKey("FK_driving_mebbis_error_occurrences_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull); });
        m.CreateIndex("IX_driving_mebbis_error_definitions_tenant_id", "driving_mebbis_error_definitions", "tenant_id");
        m.CreateIndex("IX_driving_mebbis_error_definitions_tenant_id_Code", "driving_mebbis_error_definitions", new[] { "tenant_id", "Code" }, unique: true);
        m.CreateIndex("IX_driving_mebbis_error_definitions_tenant_id_IsActive_Sever~", "driving_mebbis_error_definitions", new[] { "tenant_id", "IsActive", "Severity" });
        m.CreateIndex("IX_driving_mebbis_error_occurrences_ErrorDefinitionId", "driving_mebbis_error_occurrences", "ErrorDefinitionId");
        m.CreateIndex("IX_driving_mebbis_error_occurrences_StudentDrivingProfileId", "driving_mebbis_error_occurrences", "StudentDrivingProfileId");
        m.CreateIndex("IX_driving_mebbis_error_occurrences_tenant_id", "driving_mebbis_error_occurrences", "tenant_id");
        m.CreateIndex("IX_driving_mebbis_error_occurrences_tenant_id_ErrorDefinitio~", "driving_mebbis_error_occurrences", new[] { "tenant_id", "ErrorDefinitionId", "OccurredAtUtc" });
        m.CreateIndex("IX_driving_mebbis_error_occurrences_tenant_id_ResolvedAtUtc_~", "driving_mebbis_error_occurrences", new[] { "tenant_id", "ResolvedAtUtc", "OccurredAtUtc" });
        m.CreateIndex("IX_driving_mebbis_error_occurrences_tenant_id_StudentDriving~", "driving_mebbis_error_occurrences", new[] { "tenant_id", "StudentDrivingProfileId", "OccurredAtUtc" });
    }
    protected override void Down(MigrationBuilder m) { m.DropTable("driving_mebbis_error_occurrences"); m.DropTable("driving_mebbis_error_definitions"); }
}
