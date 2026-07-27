using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseIntellect.Infrastructure.Persistence.Migrations;

/// <summary>
/// Numarasız (0) kalmış eski kursiyer kayıtlarına kursiyer numarası verir.
/// Yeni kayıtlar zaten "en büyük numara + 1" ile açılıyor; numaralandırma
/// eklenmeden önce oluşan satırlar ekranlarda "#0" görünüyordu.
///
/// Numaralar kurum (tenant) bazında ve kayıt sırasına göre, o kurumdaki mevcut
/// en büyük numaranın ardından verilir; böylece kullanılan numaralar korunur ve
/// çakışma olmaz. Yalnız 0 olan satırlara dokunur, tekrar çalıştırılabilir.
/// </summary>
[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260727091000_BackfillDrivingStudentNumbers")]
public sealed class BackfillDrivingStudentNumbers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            WITH taken AS (
                SELECT tenant_id, COALESCE(MAX("StudentNumber"), 0) AS max_no
                FROM student_driving_profiles
                GROUP BY tenant_id
            ),
            numbered AS (
                SELECT p."Id",
                       t.max_no + ROW_NUMBER() OVER (
                           PARTITION BY p.tenant_id ORDER BY p."RegisteredAtUtc", p."Id"
                       ) AS new_no
                FROM student_driving_profiles p
                JOIN taken t ON t.tenant_id IS NOT DISTINCT FROM p.tenant_id
                WHERE p."StudentNumber" = 0
            )
            UPDATE student_driving_profiles p
            SET "StudentNumber" = n.new_no
            FROM numbered n
            WHERE p."Id" = n."Id";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Geri alma yok: hangi numaraların sonradan verildiği kaydedilmiyor ve
        // numaraları 0'a döndürmek veri kaybı olurdu.
    }
}
