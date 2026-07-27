using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

/// <summary>
/// Çalışma izni takibi henüz başlatılmamış (iki alanı da boş) öğretmenler,
/// önceki tutarsız otomatik durum hesabıyla pasife düşmüş olabilir. Yalnız
/// otomatik yönetilen ve belge bilgisi tamamen boş profilleri tekrar aktif eder.
/// Kısmi, süresi geçmiş veya yönetici tarafından pasife alınmış kayıtlara dokunmaz.
/// </summary>
[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260727133000_ReactivateUntrackedDrivingInstructors")]
public sealed class ReactivateUntrackedDrivingInstructors : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE driving_instructor_profiles
            SET "IsActive" = TRUE,
                "StatusChangeSource" = 'Automatic',
                "StatusChangeReason" = 'Çalışma izni takibi henüz başlatılmamış.',
                "StatusChangedAtUtc" = NOW()
            WHERE "AutomaticStatusEnabled" = TRUE
              AND COALESCE(BTRIM("WorkingPermitNo"), '') = ''
              AND "WorkingPermitExpiresAtUtc" IS NULL
              AND "IsActive" = FALSE;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Geri alma, yöneticinin sonradan yaptığı aktiflik değişikliklerini bozabilir.
    }
}
