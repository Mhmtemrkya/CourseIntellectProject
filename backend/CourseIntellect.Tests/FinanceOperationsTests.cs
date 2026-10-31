using System.Text;
using CourseIntellect.Application.DTOs.Accounting;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>Muhasebe eksiklerinin (2026-10-30) tamamlanması: gün sonu, kurallar, mutabakat, yaşam döngüsü, toplu tahsilat, döviz.</summary>
public sealed class FinanceOperationsTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly RecordingPush push = new();
    private readonly RecordingEmail email = new();

    public void Dispose() => db.Dispose();

    private StudentFinanceService Service => new(
        db.Context,
        new ParentNotifier(db.Context, push),
        new NoopAuditLog(),
        new InstitutionProfileService(db.Context, new EmptyTenantContext(), new NoopAuditLog()));

    private AccountingService Accounting => new(db.Context, Service);
    private FinanceDayCloseService DayClose => new(db.Context);
    private ReconciliationService Reconciliation => new(db.Context);

    private static DateTime Today => FinanceDates.TodayUtcDate(DateTime.UtcNow);

    private Task<EnrollmentContractDto> EnrollAsync(Guid? userId, string name, decimal net, int installments, DateTime? firstDue = null, string currency = "TRY")
        => Service.CreateEnrollmentAsync(new CreateEnrollmentRequest(
            userId, name, "9-A", "2026", net, 0, null, 0, installments,
            firstDue ?? DateTime.UtcNow.Date.AddMonths(1), currency, null), null);

    private async Task<AppUser> SeedStudentAsync(string name, Guid? parentUserId = null, string parentEmail = "")
    {
        var user = new AppUser { FullName = name, Username = $"u-{Guid.NewGuid():N}", PasswordHash = "x", PrimaryRole = UserRole.Student };
        db.Context.Users.Add(user);
        db.Context.Students.Add(new StudentProfile { UserId = user.Id, FullName = name, ClassName = "9-A", ParentUserId = parentUserId, ParentEmail = parentEmail, ParentName = "Ayşe Hanım" });
        await db.Context.SaveChangesAsync();
        return user;
    }

    // ── Gün sonu kasa kapanışı ───────────────────────────────────────────────
    [Fact]
    public async Task DayClose_ComputesExpectedCash_AndLocksTheDay()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 2_000m, 1);
        var cash = await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 500m, "Nakit", null), null);
        await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 200m, "Kredi Kartı", null), null);
        await Service.RefundPaymentAsync(new RefundRequest(cash.Id, 100m, "PaymentReversal", "Düzeltme", "Nakit", null), null);
        db.Context.DrivingExpenses.Add(new DrivingExpense { Title = "Kırtasiye", Amount = 50m, PaymentMethod = "Nakit", ExpenseDateUtc = DateTime.UtcNow });
        db.Context.DrivingExpenses.Add(new DrivingExpense { Title = "Onaysız", Amount = 999m, PaymentMethod = "Nakit", ExpenseDateUtc = DateTime.UtcNow, ApprovalStatus = "Bekliyor" });
        await db.Context.SaveChangesAsync();

        var summary = await DayClose.GetSummaryAsync(Today);
        Assert.Equal(500m, summary.CashIn);
        Assert.Equal(150m, summary.CashOut);
        Assert.Equal(350m, summary.ExpectedCash);
        Assert.Equal(200m, summary.CardIn);

        var closing = await DayClose.CloseAsync(new CloseFinanceDayRequest(Today, 340m, "10 TL eksik"), null, "Muhasebe");
        Assert.Equal(-10m, closing.Difference);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.RecordPaymentAsync(
            new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 100m, "Nakit", null), null));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.DeleteCollectionAsync(cash.Id));

        Assert.True(await DayClose.ReopenAsync(Today, "Eksik tahsilat girilecek"));
        await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 100m, "Nakit", null), null);
    }

    // ── Gecikme kuralları ────────────────────────────────────────────────────
    [Fact]
    public async Task OverdueRules_FireOncePerRule_WithTemplate_AndOnlyPastThreshold()
    {
        var tenant = new TenantWorkspace { Name = "Kurum", Slug = $"k-{Guid.NewGuid():N}", ContactEmail = "k@k.com" };
        db.Context.TenantWorkspaces.Add(tenant);
        await db.Context.SaveChangesAsync();
        db.Context.SetTenantOverride(tenant.Id);

        var parentId = Guid.NewGuid();
        var student = await SeedStudentAsync("Ali Can", parentId, "veli@ornek.com");
        await EnrollAsync(student.Id, "Ali Can", 1_000m, 1, firstDue: Today.AddDays(-5));
        db.Context.PlatformConfigurations.Add(new PlatformConfiguration
        {
            TenantId = tenant.Id,
            ConfigurationType = "overdue-rules",
            ScopeKey = "default",
            PayloadJson = """{"rules":[{"id":"r3","name":"3 gün","daysAfterDue":3,"channel":"both","template":"Sayın {parentName}, {studentName} için {amount} TL gecikti.","enabled":true},{"id":"r10","name":"10 gün","daysAfterDue":10,"channel":"notification","template":"Ağır gecikme","enabled":true}]}""",
        });
        await db.Context.SaveChangesAsync();

        var service = new OverdueRuleReminderService(db.Context, new ParentNotifier(db.Context, push), email);
        var first = await service.RunAsync();
        var second = await service.RunAsync();

        Assert.True(first.RulesActive);
        Assert.Equal(1, first.Sent);
        Assert.Equal(0, second.Sent);
        var notification = await db.Context.Notifications.SingleAsync();
        Assert.Equal(parentId, notification.TargetUserId);
        // Veli adı kurumun ad biçimine göre yazılır (soyadı büyük harf); şablon değişkenleri dolar.
        Assert.StartsWith("Sayın Ayşe", notification.Message);
        Assert.EndsWith("Ali Can için 1.000,00 TL gecikti.", notification.Message);
        Assert.Single(email.Sent, "veli@ornek.com");
    }

    // ── Dışa aktarma ─────────────────────────────────────────────────────────
    [Fact]
    public async Task JournalExport_ListsCollectionsRefundsAndPaidExpenses()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 1);
        var payment = await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 400m, "Havale", null), null);
        await Service.RefundPaymentAsync(new RefundRequest(payment.Id, 100m, "PaymentReversal", "Düzeltme", "Havale", "REF-1"), null);
        db.Context.AccountingSalaries.Add(new AccountingSalary { Employee = "Öğretmen A", Role = "Öğretmen", Amount = "10.000 TL", PayDate = "01.11.2026", Status = "Ödendi", PaidAtUtc = DateTime.UtcNow, PaymentMethod = "Havale" });
        db.Context.AccountingSalaries.Add(new AccountingSalary { Employee = "Öğretmen B", Role = "Öğretmen", Amount = "9.000 TL", PayDate = "01.11.2026", Status = "Planlandı" });
        await db.Context.SaveChangesAsync();

        var csv = Encoding.UTF8.GetString(await new FinanceJournalExportService(db.Context).ExportCsvAsync(null, null)).TrimStart('﻿');
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.StartsWith("Tarih;Belge No;Tür;", lines[0]);
        Assert.Contains(lines, line => line.Contains(";Tahsilat;Ada Yılmaz;") && line.Contains(";400,00;"));
        Assert.Contains(lines, line => line.Contains(";İade;") && line.Contains(";100,00;"));
        Assert.Contains(lines, line => line.Contains(";Maaş Ödemesi;Öğretmen A;") && line.Contains(";10000,00;"));
        Assert.DoesNotContain(lines, line => line.Contains("Öğretmen B"));
    }

    // ── Banka mutabakatı ─────────────────────────────────────────────────────
    [Fact]
    public async Task Reconciliation_MatchesBankLinesBothWays_SkipsCash_AndPersists()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 2_000m, 1);
        await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 500m, "Nakit", null), null);
        await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 500m, "Havale", null), null);
        db.Context.AccountingSalaries.Add(new AccountingSalary { Employee = "A", Role = "Ö", Amount = "7.500 TL", PayDate = "x", Status = "Ödendi", PaidAtUtc = DateTime.UtcNow, PaymentMethod = "Havale" });
        await db.Context.SaveChangesAsync();
        var rows = new List<BankStatementRow>
        {
            new("B-1", 500m, DateTime.UtcNow.Date, "Gelen havale"),
            new("B-2", 500m, DateTime.UtcNow.Date, "İkinci aynı tutar"),
            new("B-3", -7_500m, DateTime.UtcNow.Date, "Maaş"),
        };

        var first = await Reconciliation.ReconcileAsync(new ReconciliationRequest(rows, 1));
        var again = await Reconciliation.ReconcileAsync(new ReconciliationRequest(rows, 1));

        Assert.Equal(2, first.Matched);
        Assert.Equal("Payment", first.Items[0].MatchedType);
        // Nakit tahsilat bankadan geçmez; ikinci 500 TL eşleşmez.
        Assert.Equal("Unmatched", first.Items[1].MatchStatus);
        Assert.Equal("Salary", first.Items[2].MatchedType);
        Assert.Equal(2, again.Matched);
        Assert.Equal(3, await db.Context.BankReconciliationEntries.CountAsync());
    }

    // ── Sözleşme dondurma / iptal ────────────────────────────────────────────
    [Fact]
    public async Task FrozenContract_HasNoOverdue_CancelledContractWritesOffUnpaid()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2, firstDue: Today.AddMonths(-3));
        await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 300m, "Nakit", null), null);
        Assert.Equal(2, (await Service.GetAllSummariesAsync(null)).Single().OverdueCount);

        await Service.ChangeContractStatusAsync(contract.Id, new ChangeContractStatusRequest("freeze", "Sağlık izni"));
        var frozen = (await Service.GetAllSummariesAsync(null)).Single();
        Assert.Equal(0, frozen.OverdueCount);
        Assert.Equal(700m, frozen.Balance);

        await Service.ChangeContractStatusAsync(contract.Id, new ChangeContractStatusRequest("cancel", "Okuldan ayrıldı"));
        var cancelled = (await Service.GetAllSummariesAsync(null)).Single();
        Assert.Equal(0m, cancelled.Balance);
        Assert.Equal(300m, cancelled.PaidTotal);
        Assert.Equal(300m, (await db.Context.EnrollmentContracts.SingleAsync()).NetAmount);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.ChangeContractStatusAsync(contract.Id, new ChangeContractStatusRequest("unfreeze", "x")));
    }

    // ── Taksit yeniden yapılandırma ──────────────────────────────────────────
    [Fact]
    public async Task Restructure_KeepsPaidPart_AndSplitsRemainder()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_200m, 3);
        await Service.RecordPaymentAsync(new RecordPaymentRequest(contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 500m, "Nakit", null), null);

        var result = await Service.RestructureInstallmentsAsync(contract.Id, new RestructureInstallmentsRequest(7, Today.AddMonths(1), "Ödeme güçlüğü"));

        var rows = await db.Context.FinanceInstallments.AsNoTracking().OrderBy(x => x.SeqNo).ToListAsync();
        Assert.Equal(400m, rows[0].Amount);
        Assert.Equal(100m, rows[1].Amount);
        Assert.Equal(100m, rows[1].PaidAmount);
        Assert.Equal(7, rows.Count(x => x.Label.StartsWith("Yapılandırma")));
        Assert.Equal(700m, rows.Where(x => x.Label.StartsWith("Yapılandırma")).Sum(x => x.Amount));
        Assert.Equal(1_200m, result.NetAmount);
        Assert.Equal(500m, await db.Context.FinancePaymentAllocations.SumAsync(x => x.Amount));
    }

    // ── Toplu tahsilat ───────────────────────────────────────────────────────
    [Fact]
    public async Task BulkCollection_PreviewsThenRecords_AndIgnoresReupload()
    {
        var student = await SeedStudentAsync("Ali Can");
        await EnrollAsync(student.Id, "Ali Can", 1_000m, 1);
        var rows = new List<BulkCollectionRow>
        {
            new(1, "Ali Can", 250m, "Havale", DateTime.UtcNow.Date, "DEK-1"),
            new(2, "Bilinmeyen Kişi", 100m, "Havale", DateTime.UtcNow.Date, "DEK-2"),
        };

        var preview = await Service.BulkCollectAsync(new BulkCollectionRequest(rows, DryRun: true), null);
        Assert.Equal("Ready", preview.Rows[0].Status);
        Assert.Equal("Error", preview.Rows[1].Status);
        Assert.Empty(await db.Context.FinancePayments.ToListAsync());

        var recorded = await Service.BulkCollectAsync(new BulkCollectionRequest(rows, DryRun: false), null);
        var reupload = await Service.BulkCollectAsync(new BulkCollectionRequest(rows, DryRun: false), null);

        Assert.Equal(1, recorded.Recorded);
        Assert.Equal(250m, recorded.RecordedAmount);
        Assert.Equal("Duplicate", reupload.Rows[0].Status);
        Assert.Single(await db.Context.FinancePayments.ToListAsync());
    }

    // ── Döviz ────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Currency_IsPerStudent_AndDashboardDoesNotMixCurrencies()
    {
        var tl = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 1);
        var usd = await EnrollAsync(Guid.NewGuid(), "John Smith", 300m, 1, currency: "USD");
        await Assert.ThrowsAsync<ArgumentException>(() => EnrollAsync(tl.StudentUserId, "Ada Yılmaz", 100m, 1, currency: "EUR"));
        await Service.RecordPaymentAsync(new RecordPaymentRequest(usd.StudentUserId, "John Smith", usd.Id, null, 100m, "Havale", null), null);

        Assert.Equal("USD", (await db.Context.FinancePayments.SingleAsync()).Currency);
        var dashboard = await Service.GetDashboardAsync(null);
        Assert.Equal("TRY", dashboard.Currency);
        Assert.Equal(1_000m, dashboard.OutstandingTotal);
        var usdTotals = dashboard.CurrencyTotals!.Single(x => x.Currency == "USD");
        Assert.Equal(200m, usdTotals.OutstandingTotal);
        Assert.Equal(100m, usdTotals.CollectedTotal);
    }

    // ── Fatura ve maaş ───────────────────────────────────────────────────────
    [Fact]
    public async Task Invoice_CanBeCancelled_PaidCannotBeDeleted_SalaryPaidOnlyAfterApproval()
    {
        var invoice = await Accounting.CreateInvoiceAsync(new CreateInvoiceRequest("Elektrik", "Fatura", "1.200", DateTime.UtcNow.ToString("o"), "Ekim", IsPaid: true, PaymentMethod: "Havale"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Accounting.DeleteInvoiceAsync(Guid.Parse(invoice.Id)));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Accounting.UpdateInvoiceAsync(Guid.Parse(invoice.Id),
            new UpdateInvoiceRequest("Elektrik", "Fatura", "1.500", DateTime.UtcNow.ToString("o"))));
        var cancelled = await Accounting.CancelInvoiceAsync(Guid.Parse(invoice.Id), "Mükerrer kayıt");
        Assert.Equal("İptal", cancelled!.Status);
        Assert.False(FinanceExpenseRules.InvoiceCountsAsExpense(cancelled.Status));

        var salary = await Accounting.CreateSalaryAsync(new CreateSalaryRequest("Öğretmen A", "Öğretmen", "10000", "01.11.2026", "Kasım"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Accounting.PaySalaryAsync(Guid.Parse(salary.Id), new PaySalaryRequest("Havale")));
        var row = await db.Context.AccountingSalaries.SingleAsync();
        row.Status = "Planlandı";
        await db.Context.SaveChangesAsync();
        var paid = await Accounting.PaySalaryAsync(Guid.Parse(salary.Id), new PaySalaryRequest("Havale"));
        Assert.Equal("Ödendi", paid!.Status);
        Assert.NotNull(paid.PaidAtUtc);
    }

    [Fact]
    public async Task DatedCollection_CannotBeInTheFuture()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 1);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 100m, "Nakit", null, PaidAtUtc: DateTime.UtcNow.AddDays(2)), null));
    }

    private sealed class RecordingEmail : IEmailSender
    {
        public List<string> Sent { get; } = [];
        public bool IsConfigured => true;
        public Task<bool> SendAsync(string toAddress, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            Sent.Add(toAddress);
            return Task.FromResult(true);
        }
    }

    private sealed class RecordingPush : IPushNotificationService
    {
        public bool IsConfigured => true;
        public Task SendToUserAsync(Guid userId, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendToUserByNameAsync(string fullName, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendToRoleAsync(string role, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
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
