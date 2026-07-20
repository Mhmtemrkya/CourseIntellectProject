using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace CourseIntellect.Infrastructure.Persistence.Migrations;

/// <summary>
/// Kayıt geçmişi ekranı için iki değişiklik:
///
/// 1) <c>login_attempts</c> tablosuna kurum kolonu. Tablo bugüne kadar kapsamsızdı;
///    kurum yöneticisi rolüne açık olan uç, tüm kurumların giriş denemelerini
///    (e-posta, IP, cihaz) döndürüyordu. Kolon + sorgu filtresi bunu kapatır.
///    Mevcut satırlar hangi kuruma ait olduğu güvenilir biçimde belirlenemediği için
///    NULL bırakılır; NULL satırlar hiçbir kuruma görünmez (filtre gereği).
///
/// 2) <c>audit_log_entries</c> tablosuna işlem anındaki rol. Geriye dönük
///    doldurulmaz — o bilgi geçmişte hiç kaydedilmemişti.
/// </summary>
[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260720233000_AddActivityHistoryContext")]
public sealed class AddActivityHistoryContext : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.AddColumn<Guid>("tenant_id", "login_attempts", type: "uuid", nullable: true);
        m.CreateIndex("IX_login_attempts_tenant_id", "login_attempts", "tenant_id");
        m.AddForeignKey("FK_login_attempts_tenant_workspaces_tenant_id", "login_attempts",
            "tenant_id", "tenant_workspaces", principalColumn: "id", onDelete: ReferentialAction.SetNull);

        m.AddColumn<string>("actor_role", "audit_log_entries",
            type: "character varying(60)", maxLength: 60, nullable: true);
    }

    protected override void Down(MigrationBuilder m)
    {
        m.DropForeignKey("FK_login_attempts_tenant_workspaces_tenant_id", "login_attempts");
        m.DropIndex("IX_login_attempts_tenant_id", "login_attempts");
        m.DropColumn("tenant_id", "login_attempts");
        m.DropColumn("actor_role", "audit_log_entries");
    }
}
