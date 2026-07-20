using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260720200000_AddDrivingMebbisHistory")]
public sealed class AddDrivingMebbisHistory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "driving_mebbis_history_events",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                StudentDrivingProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                EventType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                SourceType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                SourceId = table.Column<Guid>(type: "uuid", nullable: true),
                ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ActorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                OccurredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_driving_mebbis_history_events", x => x.Id);
                table.ForeignKey(name: "FK_driving_mebbis_history_events_student_driving_profiles_Stud~",
                    column: x => x.StudentDrivingProfileId, principalTable: "student_driving_profiles", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey(name: "FK_driving_mebbis_history_events_tenant_workspaces_tenant_id",
                    column: x => x.tenant_id, principalTable: "tenant_workspaces", principalColumn: "id", onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(name: "IX_driving_mebbis_history_events_StudentDrivingProfileId", table: "driving_mebbis_history_events", column: "StudentDrivingProfileId");
        migrationBuilder.CreateIndex(name: "IX_driving_mebbis_history_events_tenant_id", table: "driving_mebbis_history_events", column: "tenant_id");
        migrationBuilder.CreateIndex(name: "IX_driving_mebbis_history_events_tenant_id_EventType_OccurredA~", table: "driving_mebbis_history_events", columns: new[] { "tenant_id", "EventType", "OccurredAtUtc" });
        migrationBuilder.CreateIndex(name: "IX_driving_mebbis_history_events_tenant_id_StudentDrivingP~", table: "driving_mebbis_history_events", columns: new[] { "tenant_id", "StudentDrivingProfileId", "OccurredAtUtc" });

        // Mevcut kayıtları kaybetmemek için yalnız kesin tarihi bulunan olaylar taşınır.
        migrationBuilder.Sql("""
            INSERT INTO driving_mebbis_history_events
            ("Id", tenant_id, "StudentDrivingProfileId", "EventType", "Severity", "Title", "Description", "Status", "SourceType", "SourceId", "ActorUserId", "ActorName", "OccurredAtUtc", "CreatedAtUtc")
            SELECT gen_random_uuid(), p.tenant_id, p."Id", 'CandidateEntry', 'Success', 'Aday kaydı MEBBİS’e girildi',
                   'Mevcut MEBBİS giriş kaydından geçmişe aktarıldı.', 'Entered', 'StudentDrivingProfile', p."Id", NULL, 'Geçmiş aktarımı', p."MebbisEnteredAtUtc", now()
            FROM student_driving_profiles p WHERE p."MebbisEnteredAtUtc" IS NOT NULL;

            INSERT INTO driving_mebbis_history_events
            ("Id", tenant_id, "StudentDrivingProfileId", "EventType", "Severity", "Title", "Description", "Status", "SourceType", "SourceId", "ActorUserId", "ActorName", "OccurredAtUtc", "CreatedAtUtc")
            SELECT gen_random_uuid(), d.tenant_id, d."StudentDrivingProfileId", 'DocumentReview',
                   CASE WHEN d."Status" = 'Approved' THEN 'Success' ELSE 'Warning' END,
                   CASE WHEN d."Status" = 'Approved' THEN 'Evrak onaylandı' ELSE 'Evrak incelemesi sonuçlandı' END,
                   d."DocumentType" || ' belgesi: ' || d."Status", d."Status", 'StudentDrivingDocument', d."Id", d."ReviewedByUserId", COALESCE(u."FullName", 'Geçmiş aktarımı'), d."ReviewedAtUtc", now()
            FROM student_driving_documents d LEFT JOIN users u ON u."Id" = d."ReviewedByUserId"
            WHERE d."ReviewedAtUtc" IS NOT NULL;

            INSERT INTO driving_mebbis_history_events
            ("Id", tenant_id, "StudentDrivingProfileId", "EventType", "Severity", "Title", "Description", "Status", "SourceType", "SourceId", "ActorUserId", "ActorName", "OccurredAtUtc", "CreatedAtUtc")
            SELECT gen_random_uuid(), c.tenant_id, c."StudentDrivingProfileId", 'ExamResult',
                   CASE WHEN c."Status" = 'Passed' THEN 'Success' ELSE 'Warning' END,
                   'Sınav sonucu işlendi', 'Mevcut sınav sonucundan geçmişe aktarıldı.', c."Status", 'DrivingExamCandidate', c."Id", c."ResultEnteredByUserId", COALESCE(u."FullName", 'Geçmiş aktarımı'), c."ResultEnteredAtUtc", now()
            FROM driving_exam_candidates c LEFT JOIN users u ON u."Id" = c."ResultEnteredByUserId"
            WHERE c."ResultEnteredAtUtc" IS NOT NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropTable(name: "driving_mebbis_history_events");
}
