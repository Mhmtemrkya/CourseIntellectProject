using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Kurum künyesi ekranından girilen bilgiler belgelerin (ekstre) başlığına
/// gerçekten yansıyor mu ve künye yokken mevcut kurum verisi devreye giriyor mu.
/// </summary>
public sealed class InstitutionProfileTests : IDisposable
{
    private readonly TestDb db = new();

    private InstitutionProfileService Profiles =>
        new(db.Context, new EmptyTenantContext(), new NoopAuditLog());

    private StudentFinanceService Finance => new(
        db.Context,
        new NoopParentNotifier(),
        new NoopAuditLog(),
        Profiles);

    [Fact]
    public async Task GetEffective_FallsBackToDrivingSchoolSettingsWhenProfileMissing()
    {
        db.Context.DrivingSchoolSettings.Add(new DrivingSchoolSettings
        {
            FormInstitutionName = "Özel Yakutiye Sürücü Kursu",
            FormInstitutionAddress = "Lalapaşa Mah. No:9",
            FormInstitutionDistrict = "Yakutiye",
            FormInstitutionCity = "Erzurum",
            FormInstitutionPhone = "0442 111 22 33",
        });
        await db.Context.SaveChangesAsync();

        var profile = await Profiles.GetEffectiveAsync();

        Assert.False(profile.IsConfigured);
        Assert.Equal("Özel Yakutiye Sürücü Kursu", profile.Name);
        Assert.Equal("Lalapaşa Mah. No:9", profile.Address);
        Assert.Equal("Yakutiye / ERZURUM", profile.Location);
        Assert.Equal("0442 111 22 33", profile.Phone);
    }

    [Fact]
    public async Task Save_OverridesFallbacksAndTrimsOverlongValues()
    {
        db.Context.DrivingSchoolSettings.Add(new DrivingSchoolSettings { FormInstitutionName = "Eski Ad" });
        await db.Context.SaveChangesAsync();

        var saved = await Profiles.SaveAsync(new SaveInstitutionProfileRequest(
            "  Erzurum Koleji  ",
            "Ömer Nasuhi Bilmen Mah. No:45",
            "Yakutiye",
            "Erzurum",
            "(0442) 123 45 67",
            "info@erzurumkoleji.k12.tr",
            "www.erzurumkoleji.k12.tr",
            new string('x', 200),
            "1234567890",
            "Bu belge bilgilendirme amaçlıdır."), null);

        Assert.True(saved.IsConfigured);
        Assert.Equal("Erzurum Koleji", saved.Name);
        Assert.Equal(120, saved.TaxOffice.Length);

        // İkinci kayıt yeni satır açmaz; kurum başına tek künye tutulur.
        await Profiles.SaveAsync(new SaveInstitutionProfileRequest(
            "Erzurum Koleji", null, null, null, null, null, null, null, null, null), null);
        Assert.Single(db.Context.InstitutionProfiles);
    }

    [Fact]
    public async Task Statement_UsesSavedInstitutionProfileForDocumentHeader()
    {
        await Profiles.SaveAsync(new SaveInstitutionProfileRequest(
            "Erzurum Koleji",
            "Ömer Nasuhi Bilmen Mah. No:45",
            "Yakutiye",
            "Erzurum",
            "(0442) 123 45 67",
            "info@erzurumkoleji.k12.tr",
            "www.erzurumkoleji.k12.tr",
            "Yakutiye",
            "1234567890",
            "Ödemeler yalnız kurum kasasına yapılır."), null);

        var finance = Finance;
        await finance.CreateEnrollmentAsync(new CreateEnrollmentRequest(
            null, "Ada Yılmaz", "10-A", "2026", 12_000m, 0, null, 2_000m, 2,
            DateTime.UtcNow.AddMonths(1), "TRY", null), null);

        var statement = await finance.GetStatementAsync(null, "Ada Yılmaz", null, null);

        Assert.Equal("Erzurum Koleji", statement.InstitutionName);
        Assert.Equal("Ömer Nasuhi Bilmen Mah. No:45", statement.InstitutionAddress);
        Assert.Equal("Yakutiye / ERZURUM", statement.InstitutionLocation);
        Assert.Equal("Vergi D.: Yakutiye • VKN: 1234567890", statement.InstitutionTaxInfo);
        Assert.Equal("Ödemeler yalnız kurum kasasına yapılır.", statement.Note);
        // Peşinat + iki taksit borç, peşinat tahsilatı alacak → kalan 10.000.
        Assert.Equal(12_000m, statement.DebitTotal);
        Assert.Equal(2_000m, statement.CreditTotal);
        Assert.Equal(10_000m, statement.ClosingBalance);
    }

    public void Dispose() => db.Dispose();

    private sealed class NoopParentNotifier : IParentNotifier
    {
        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class EmptyTenantContext : ITenantContext
    {
        public Guid? CurrentTenantId => null;
        public bool HasTenant => false;
    }

    private sealed class NoopAuditLog : IAuditLogService
    {
        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditLogDto>>([]);
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditBranchSummaryDto>>([]);
    }
}
