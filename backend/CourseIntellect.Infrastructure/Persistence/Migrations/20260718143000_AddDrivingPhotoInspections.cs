using System;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260718143000_AddDrivingPhotoInspections")]
public sealed class AddDrivingPhotoInspections : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "driving_photo_inspections",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                StudentDrivingDocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                SourceSha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                SourceBytes = table.Column<long>(type: "bigint", nullable: false),
                Width = table.Column<int>(type: "integer", nullable: false),
                Height = table.Column<int>(type: "integer", nullable: false),
                FaceCount = table.Column<int>(type: "integer", nullable: false),
                FaceConfidence = table.Column<double>(type: "double precision", nullable: true),
                AverageBrightness = table.Column<double>(type: "double precision", nullable: false),
                BackgroundUniformity = table.Column<double>(type: "double precision", nullable: false),
                Overall = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                ChecksJson = table.Column<string>(type: "jsonb", nullable: false),
                MebbisFileUrl = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                MebbisBytes = table.Column<long>(type: "bigint", nullable: true),
                MebbisWidth = table.Column<int>(type: "integer", nullable: true),
                MebbisHeight = table.Column<int>(type: "integer", nullable: true),
                AnalyzerVersion = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_driving_photo_inspections", x => x.Id);
                table.ForeignKey("FK_driving_photo_inspections_student_driving_documents_Student~", x => x.StudentDrivingDocumentId, "student_driving_documents", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_driving_photo_inspections_student_driving_profiles_StudentDr~", x => x.StudentDrivingProfileId, "student_driving_profiles", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_driving_photo_inspections_tenant_workspaces_tenant_id", x => x.tenant_id, "tenant_workspaces", "id", onDelete: ReferentialAction.SetNull);
            });
        migrationBuilder.CreateIndex("IX_driving_photo_inspections_StudentDrivingDocumentId", "driving_photo_inspections", "StudentDrivingDocumentId");
        migrationBuilder.CreateIndex("IX_driving_photo_inspections_StudentDrivingProfileId", "driving_photo_inspections", "StudentDrivingProfileId");
        migrationBuilder.CreateIndex("IX_driving_photo_inspections_tenant_id", "driving_photo_inspections", "tenant_id");
        migrationBuilder.CreateIndex("IX_driving_photo_inspections_tenant_id_StudentDrivingDocumen~", "driving_photo_inspections", new[] { "tenant_id", "StudentDrivingDocumentId", "CreatedAtUtc" });
        migrationBuilder.CreateIndex("IX_driving_photo_inspections_tenant_id_StudentDrivingProfile~", "driving_photo_inspections", new[] { "tenant_id", "StudentDrivingProfileId", "CreatedAtUtc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("driving_photo_inspections");
}
