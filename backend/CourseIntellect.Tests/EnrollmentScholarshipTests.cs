using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Burs hesabı.
///
/// Değişmez kural: <c>DiscountAmount</c> TOPLAM indirimdir ve bursu içerir.
/// Net = Brüt − toplam indirim; taksit planı net üzerinden kurulur. Böylece
/// tahsilat, ekstre ve iade tarafı burstan habersiz çalışır — burs ayrı bir
/// hesap yolu açmaz. Bu testler o kuralı kilitler.
/// </summary>
public sealed class EnrollmentScholarshipTests : IDisposable
{
    private readonly TestDb db = new();

    private StudentFinanceService Service => new(
        db.Context,
        new NoopParentNotifier(),
        new NoopAuditLog(),
        new InstitutionProfileService(db.Context, new EmptyTenantContext(), new NoopAuditLog()));

    private Task<EnrollmentContractDto> CreateAsync(
        decimal gross,
        decimal otherDiscount = 0,
        decimal scholarshipPercent = 0,
        int installments = 0,
        decimal downPayment = 0,
        string? reason = null) => Service.CreateEnrollmentAsync(new CreateEnrollmentRequest(
            null, "Ada Yılmaz", "10-A", "2026", gross, otherDiscount, reason,
            downPayment, installments, DateTime.UtcNow.AddMonths(1), "TRY", null,
            null, true, scholarshipPercent), null);

    [Fact]
    public async Task Scholarship_ReducesNet_ByPercentOfGross()
    {
        var contract = await CreateAsync(gross: 20_000m, scholarshipPercent: 40m);

        Assert.Equal(40m, contract.ScholarshipPercent);
        Assert.Equal(8_000m, contract.ScholarshipAmount);
        Assert.Equal(8_000m, contract.DiscountAmount);   // toplam indirim = burs
        Assert.Equal(12_000m, contract.NetAmount);
    }

    [Fact]
    public async Task Scholarship_StacksWithOtherDiscount_InSingleTotal()
    {
        var contract = await CreateAsync(gross: 20_000m, otherDiscount: 1_000m, scholarshipPercent: 25m);

        Assert.Equal(5_000m, contract.ScholarshipAmount);
        Assert.Equal(6_000m, contract.DiscountAmount);   // 5.000 burs + 1.000 diğer
        Assert.Equal(14_000m, contract.NetAmount);
    }

    [Fact]
    public async Task InstallmentPlan_IsBuiltFromNet_AfterScholarship()
    {
        // %50 burs → net yarıya iner → taksitler de yarıya iner.
        var contract = await CreateAsync(gross: 24_000m, scholarshipPercent: 50m, installments: 4);

        Assert.Equal(12_000m, contract.NetAmount);
        var rows = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).ToListAsync();
        Assert.Equal(4, rows.Count);
        Assert.All(rows, row => Assert.Equal(3_000m, row.Amount));
        Assert.Equal(12_000m, rows.Sum(x => x.Amount));
    }

    [Fact]
    public async Task FullScholarship_LeavesNothingToCollect()
    {
        var contract = await CreateAsync(gross: 18_000m, scholarshipPercent: 100m, installments: 3);

        Assert.Equal(18_000m, contract.ScholarshipAmount);
        Assert.Equal(0m, contract.NetAmount);
        // Ödenecek bir şey yoksa taksit üretilmez.
        Assert.Empty(await db.Context.FinanceInstallments.ToListAsync());
    }

    [Fact]
    public async Task DiscountAndScholarship_CannotExceedGross()
    {
        // %80 burs + 10.000 indirim = 26.000 > brüt. Toplam brütte kırpılır ve
        // bursun KAYITLI tutarı da gerçekte uygulanandan büyük olmamalı.
        var contract = await CreateAsync(gross: 20_000m, otherDiscount: 10_000m, scholarshipPercent: 80m);

        Assert.Equal(20_000m, contract.DiscountAmount);
        Assert.Equal(0m, contract.NetAmount);
        Assert.True(contract.ScholarshipAmount <= contract.DiscountAmount);
    }

    [Fact]
    public async Task PercentOutOfRange_IsClampedServerSide()
    {
        var contract = await CreateAsync(gross: 10_000m, scholarshipPercent: 250m);

        Assert.Equal(100m, contract.ScholarshipPercent);
        Assert.Equal(10_000m, contract.ScholarshipAmount);
    }

    [Fact]
    public async Task WithoutScholarship_NothingChanges()
    {
        var contract = await CreateAsync(gross: 15_000m, otherDiscount: 2_000m, reason: "Kardeş indirimi");

        Assert.Equal(0m, contract.ScholarshipPercent);
        Assert.Equal(0m, contract.ScholarshipAmount);
        Assert.Equal(2_000m, contract.DiscountAmount);
        Assert.Equal(13_000m, contract.NetAmount);
        Assert.Equal("Kardeş indirimi", contract.DiscountReason);
    }

    [Fact]
    public async Task DiscountReason_MentionsScholarship()
    {
        var withBoth = await CreateAsync(gross: 10_000m, otherDiscount: 500m, scholarshipPercent: 30m, reason: "Kardeş");
        Assert.Equal("%30 burs + Kardeş", withBoth.DiscountReason);

        var onlyScholarship = await CreateAsync(gross: 10_000m, scholarshipPercent: 12.5m);
        Assert.Equal("%12,5 burs", onlyScholarship.DiscountReason);
    }

    [Fact]
    public async Task Account_ReportsHighestPercent_AndTotalAmount()
    {
        await CreateAsync(gross: 10_000m, scholarshipPercent: 20m);
        await CreateAsync(gross: 20_000m, scholarshipPercent: 35m);

        var account = await Service.GetAccountAsync(null, "Ada Yılmaz");

        Assert.Equal(35m, account.ScholarshipPercent);       // en yüksek oran
        Assert.Equal(9_000m, account.ScholarshipAmount);     // 2.000 + 7.000
    }

    [Fact]
    public async Task ScholarshipStudent_CollectsOnlyNet()
    {
        // %60 burslu öğrenciden yalnız net tahsil edilir; net kapanınca borç biter.
        var contract = await CreateAsync(gross: 25_000m, scholarshipPercent: 60m, installments: 2);
        Assert.Equal(10_000m, contract.NetAmount);

        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 10_000m, "Nakit", null), null);

        var account = await Service.GetAccountAsync(null, "Ada Yılmaz");
        Assert.Equal(10_000m, account.PaidTotal);
        Assert.Equal(0m, account.TotalPayable);
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
