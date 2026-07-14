using System.Security.Claims;
using System.Text;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;

namespace CourseIntellect.Tests;

/// <summary>
/// Raporlamanın iş sözleşmesi.
///
/// <para>En kritik kural: <c>driving.report.view</c> sekreterde ve filo sorumlusunda
/// da vardır ama <c>driving.finance.report.view</c> YOKTUR. DrivingReportsController
/// parasal sütunları (servis maliyeti, yanan tutar) bu ikinci koda göre ekler.
/// Aşağıdaki testler o varsayımı kilitler — biri kataloğa finans yetkisi eklerse
/// rapor sessizce finans sızdırmadan önce burası kırılır.</para>
/// </summary>
public sealed class DrivingReportTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly IMemoryCache cache = new MemoryCache(new MemoryCacheOptions());

    private DrivingPermissionService Service => new(db.Context, cache);

    private static ClaimsPrincipal User(string role, Guid? customRoleId = null)
    {
        var claims = new List<Claim>
        {
            new("role", role),
            new("tenant_id", Guid.NewGuid().ToString()),
            new("nameid", Guid.NewGuid().ToString()),
        };
        if (customRoleId is not null) claims.Add(new Claim("custom_role_id", customRoleId.Value.ToString()));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test", "name", "role"));
    }

    [Fact]
    public async Task Secretary_CanSeeReports_ButNeverTheirMoneyColumns()
    {
        var permissions = await Service.GetPermissionsAsync(User("Administrative"));

        Assert.Contains(DrivingPermissions.ReportView, permissions);
        Assert.DoesNotContain(DrivingPermissions.FinanceReportView, permissions);
        Assert.DoesNotContain(DrivingPermissions.ReportExport, permissions);
    }

    /// <summary>
    /// Filo sorumlusu bir JWT rolü DEĞİL — Administrative tabanlı özel roldür.
    /// Rapor görür (araç/filo dökümü işi), ama finans sütunlarını ve dışa aktarmayı görmez.
    /// </summary>
    [Fact]
    public async Task FleetCustomRole_CanSeeReports_ButNotFinanceOrExport()
    {
        var role = new CustomRole
        {
            Name = "Filo Sorumlusu",
            BaseRole = UserRole.Administrative,
            Permissions = DrivingPermissionCatalog.DefaultsFor(DrivingPermissionCatalog.Fleet).ToList(),
        };
        db.Context.CustomRoles.Add(role);
        await db.Context.SaveChangesAsync();

        var permissions = await Service.GetPermissionsAsync(User("Administrative", role.Id));

        Assert.Contains(DrivingPermissions.ReportView, permissions);
        Assert.DoesNotContain(DrivingPermissions.FinanceReportView, permissions);
        Assert.DoesNotContain(DrivingPermissions.ReportExport, permissions);
    }

    [Fact]
    public async Task Accounting_CanViewExportAndSeeFinanceColumns()
    {
        var permissions = await Service.GetPermissionsAsync(User("Accounting"));

        Assert.Contains(DrivingPermissions.ReportView, permissions);
        Assert.Contains(DrivingPermissions.ReportExport, permissions);
        Assert.Contains(DrivingPermissions.FinanceReportView, permissions);
    }

    [Fact]
    public async Task Student_CannotSeeAnyReport()
    {
        var permissions = await Service.GetPermissionsAsync(User("Student"));

        Assert.DoesNotContain(DrivingPermissions.ReportView, permissions);
        Assert.DoesNotContain(DrivingPermissions.ReportExport, permissions);
    }

    [Fact]
    public void ReportPdf_RendersTableWithSummary()
    {
        var bytes = new DrivingReportPdfService().Generate(Document(
            [["Ahmet Yılmaz", "12", "10", "1", "1", "600", "10,0", "4,25"]]));

        Assert.True(bytes.Length > 3_000);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    /// <summary>Boş aralıkta da geçerli bir PDF üretilmeli — rapor "hiç kayıt yok" der, patlamaz.</summary>
    [Fact]
    public void ReportPdf_WithNoRows_StillProducesValidPdf()
    {
        var bytes = new DrivingReportPdfService().Generate(Document([]));

        Assert.True(bytes.Length > 1_000);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    private static DrivingReportDocument Document(IReadOnlyList<IReadOnlyList<string>> rows) => new(
        "Demo Sürücü Kursu",
        "Eğitmen Performans Raporu",
        "Eğitmen başına randevu dağılımı ve değerlendirme ortalaması.",
        new DateTime(2026, 6, 14, 0, 0, 0, DateTimeKind.Utc),
        new DateTime(2026, 7, 14, 0, 0, 0, DateTimeKind.Utc),
        [
            new("Eğitmen"), new("Randevu", true), new("Tamamlanan", true), new("İptal", true),
            new("Devamsızlık", true), new("Dakika", true), new("Saat", true), new("Ort. Puan", true),
        ],
        rows,
        [("Eğitmen", "1"), ("Tamamlanan ders", "10"), ("İşlenen süre", "10,0 sa")]);

    public void Dispose()
    {
        db.Dispose();
        cache.Dispose();
    }
}
