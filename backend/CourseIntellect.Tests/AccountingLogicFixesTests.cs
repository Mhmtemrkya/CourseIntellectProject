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

/// <summary>Muhasebe denetiminde (2026-10-30) bulunan mantık hatalarının regresyon testleri.</summary>
public sealed class AccountingLogicFixesTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly RecordingPush push = new();

    public void Dispose() => db.Dispose();

    private StudentFinanceService Service => new(
        db.Context,
        new ParentNotifier(db.Context, push),
        new NoopAuditLog(),
        new InstitutionProfileService(db.Context, new EmptyTenantContext(), new NoopAuditLog()));

    private AccountingService Accounting => new(db.Context, Service);

    private static DateTime NextMonth => DateTime.UtcNow.Date.AddMonths(1);

    private Task<EnrollmentContractDto> EnrollAsync(
        Guid? userId, string name, decimal net, int installments, decimal downPayment = 0, bool downPaymentPaid = true)
        => Service.CreateEnrollmentAsync(new CreateEnrollmentRequest(
            userId, name, "9-A", "2026", net, 0, null, downPayment, installments,
            NextMonth, "TRY", null, "Nakit", downPaymentPaid), null);

    private async Task<AppUser> SeedStudentAsync(string name, Guid? parentUserId = null)
    {
        var user = new AppUser
        {
            FullName = name,
            Username = $"u-{Guid.NewGuid():N}",
            PasswordHash = "test",
            PrimaryRole = UserRole.Student,
        };
        db.Context.Users.Add(user);
        db.Context.Students.Add(new StudentProfile
        {
            UserId = user.Id,
            FullName = name,
            ClassName = "9-A",
            ParentUserId = parentUserId,
        });
        await db.Context.SaveChangesAsync();
        return user;
    }

    // ── 4: genel tahsilat bekleyen peşinatı önce kapatır ─────────────────────
    [Fact]
    public async Task GeneralPayment_SettlesPendingDownPaymentBeforeInstallments()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2, downPayment: 200m, downPaymentPaid: false);

        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", null, null, 500m, "Nakit", null), null);

        var saved = await db.Context.EnrollmentContracts.AsNoTracking().SingleAsync();
        Assert.Equal(200m, saved.DownPaymentPaidAmount);
        Assert.True(saved.DownPaymentPaid);
        var downPayment = await db.Context.FinancePayments.SingleAsync(x => x.Note == StudentFinanceService.DownPaymentNote);
        Assert.Equal(200m, downPayment.Amount);
        var main = await db.Context.FinancePayments.SingleAsync(x => x.Note != StudentFinanceService.DownPaymentNote);
        Assert.Equal(300m, main.Amount);
        Assert.Equal(300m, await db.Context.FinanceInstallments.SumAsync(x => x.PaidAmount));
        Assert.Empty(await Service.GetPendingDownPaymentsAsync());
    }

    [Fact]
    public async Task PaymentSmallerThanPendingDownPayment_ReturnsDownPaymentReceipt()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2, downPayment: 200m, downPaymentPaid: false);

        var receipt = await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", null, null, 150m, "Nakit", null), null);

        Assert.True(receipt.IsDownPayment);
        Assert.Equal(150m, receipt.Amount);
        Assert.Equal(50m, (await Service.GetPendingDownPaymentsAsync()).Single().DownPayment);
        Assert.Equal(0m, await db.Context.FinanceInstallments.SumAsync(x => x.PaidAmount));
    }

    // ── 1 / 13: tahsilat düzeltme ve silme ───────────────────────────────────
    [Fact]
    public async Task DeletingDownPaymentReceipt_ReopensPendingDownPayment_AndLeavesInstallmentsAlone()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2, downPayment: 200m);
        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 400m, "Nakit", null), null);
        var downPayment = await db.Context.FinancePayments.SingleAsync(x => x.Note == StudentFinanceService.DownPaymentNote);

        await Service.DeleteCollectionAsync(downPayment.Id);

        var saved = await db.Context.EnrollmentContracts.AsNoTracking().SingleAsync();
        Assert.Equal(0m, saved.DownPaymentPaidAmount);
        Assert.False(saved.DownPaymentPaid);
        // Peşinat taksitlere hiç dağıtılmaz; taksitlerde yalnız gerçek 400 TL durur.
        Assert.Equal(400m, await db.Context.FinanceInstallments.SumAsync(x => x.PaidAmount));
    }

    [Fact]
    public async Task EditingDownPaymentReceipt_KeepsMarker_AndSyncsContract()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2, downPayment: 200m);
        var downPayment = await db.Context.FinancePayments.SingleAsync();

        var updated = await Service.UpdateCollectionAsync(downPayment.Id, "Ada Yılmaz", 150m, "Kart", "kart slibi");

        Assert.True(updated.IsDownPayment);
        Assert.StartsWith(StudentFinanceService.DownPaymentNote, updated.Note);
        var saved = await db.Context.EnrollmentContracts.AsNoTracking().SingleAsync(x => x.Id == contract.Id);
        Assert.Equal(150m, saved.DownPaymentPaidAmount);
        Assert.False(saved.DownPaymentPaid);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.UpdateCollectionAsync(downPayment.Id, "Ada Yılmaz", 250m, "Kart", null));
    }

    [Fact]
    public async Task CollectionAppliedToInstallments_CannotBeEditedOrDeleted()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2);
        var payment = await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 300m, "Nakit", null), null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.UpdateCollectionAsync(payment.Id, "Ada Yılmaz", 100m, "Nakit", null));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.DeleteCollectionAsync(payment.Id));
        Assert.Equal(300m, await db.Context.FinanceInstallments.SumAsync(x => x.PaidAmount));
    }

    // ── 3: pano avansı başka öğrencinin borcundan düşmez ─────────────────────
    [Fact]
    public async Task Dashboard_DoesNotNetOneStudentsAdvanceAgainstAnothersDebt()
    {
        var a = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 1);
        await EnrollAsync(Guid.NewGuid(), "Deniz Kaya", 1_000m, 1);
        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            a.StudentUserId, "Ada Yılmaz", a.Id, null, 2_000m, "Nakit", null), null);

        var dashboard = await Service.GetDashboardAsync(null);

        Assert.Equal(1_000m, dashboard.OutstandingTotal);
    }

    // ── 7: aynı adlı öğrenciler ──────────────────────────────────────────────
    [Fact]
    public async Task NameOnlyCollection_IsRejectedWhenNameIsAmbiguous()
    {
        var first = await SeedStudentAsync("Ali Can");
        var second = await SeedStudentAsync("Ali Can");
        await EnrollAsync(first.Id, "Ali Can", 1_000m, 1);
        await EnrollAsync(second.Id, "Ali Can", 1_000m, 1);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Accounting.CreateCollectionAsync(
            new CreateCollectionRequest("Ali Can", "9-A", "500", "Nakit", "")));
        Assert.Empty(await db.Context.FinancePayments.ToListAsync());
    }

    [Fact]
    public async Task NameOnlyCollection_IsBoundToTheOnlyStudentWithThatName()
    {
        var student = await SeedStudentAsync("Ali Can");
        await EnrollAsync(student.Id, "Ali Can", 1_000m, 1);

        await Accounting.CreateCollectionAsync(new CreateCollectionRequest("Ali Can", "9-A", "400", "Nakit", ""));

        var payment = await db.Context.FinancePayments.SingleAsync();
        Assert.Equal(student.Id, payment.StudentUserId);
        Assert.Equal(400m, await db.Context.FinanceInstallments.SumAsync(x => x.PaidAmount));
    }

    // ── 12: sıfır tutarlı tahsilat ───────────────────────────────────────────
    [Theory]
    [InlineData("0")]
    [InlineData("-50")]
    [InlineData("abc")]
    public async Task AccountingCollection_RejectsNonPositiveAmount(string amount)
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Accounting.CreateCollectionAsync(
            new CreateCollectionRequest("Ali Can", "9-A", amount, "Nakit", "")));
        Assert.Empty(await db.Context.FinancePayments.ToListAsync());
    }

    // ── 5: taksiti elle "Ödendi" yapmak ──────────────────────────────────────
    [Fact]
    public async Task MarkingInstallmentPaid_WritesARealReceipt()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2);
        var installment = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).FirstAsync();

        await Accounting.UpdateInstallmentAsync(installment.Id,
            new UpdateInstallmentRequest("500", NextMonth.ToString("dd.MM.yyyy"), "Ödendi", "", "Havale"));

        var payment = await db.Context.FinancePayments.SingleAsync();
        Assert.Equal(500m, payment.Amount);
        Assert.Equal("Havale", payment.Method);
        Assert.Equal(installment.Id, payment.FinanceInstallmentId);
        var account = await Service.GetAccountAsync(contract.StudentUserId, null);
        Assert.Equal(500m, account.PaidTotal);
        Assert.Equal(500m, account.TotalPayable);
    }

    [Fact]
    public async Task ChangingInstallmentAmount_MovesContractNet_AndCannotGoBelowCollected()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2);
        var installment = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).FirstAsync();
        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", contract.Id, installment.Id, 300m, "Nakit", null), null);

        await Service.UpdateInstallmentAsync(installment.Id, 400m, installment.DueDateUtc, "Kısmi", null, null);

        var saved = await db.Context.EnrollmentContracts.AsNoTracking().SingleAsync();
        Assert.Equal(900m, saved.NetAmount);
        Assert.Equal(saved.GrossAmount - saved.DiscountAmount, saved.NetAmount);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service.UpdateInstallmentAsync(installment.Id, 200m, installment.DueDateUtc, "Kısmi", null, null));
    }

    // ── 6: elle açılan taksit raporlara girer ────────────────────────────────
    [Fact]
    public async Task ManualInstallment_GetsItsOwnContract_AndReceivesStudentPayments()
    {
        var student = await SeedStudentAsync("Ali Can");

        await Accounting.CreateInstallmentAsync(new CreateInstallmentRequest(
            "Ali Can", "750", DateTime.UtcNow.AddDays(-5).ToString("dd.MM.yyyy"), "Kitap"));

        var installment = await db.Context.FinanceInstallments.SingleAsync();
        Assert.NotEqual(Guid.Empty, installment.EnrollmentContractId);
        Assert.Equal(student.Id, installment.StudentUserId);
        var summary = (await Service.GetAllSummariesAsync(null)).Single();
        Assert.Equal(750m, summary.Balance);
        Assert.Equal(1, summary.OverdueCount);

        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            student.Id, "Ali Can", null, null, 750m, "Nakit", null), null);
        Assert.Equal(750m, (await db.Context.FinanceInstallments.SingleAsync()).PaidAmount);
    }

    [Fact]
    public async Task Backfill_AttachesLegacyContractlessInstallments()
    {
        db.Context.FinanceInstallments.Add(new FinanceInstallment
        {
            EnrollmentContractId = Guid.Empty,
            StudentName = "Eski Öğrenci",
            SeqNo = 1,
            Label = "Manuel Taksit",
            DueDateUtc = NextMonth,
            Amount = 300m,
            Status = "Pending",
            Currency = "TRY",
        });
        await db.Context.SaveChangesAsync();

        await Service.BackfillMissingInstallmentsAsync();

        var installment = await db.Context.FinanceInstallments.SingleAsync();
        Assert.NotEqual(Guid.Empty, installment.EnrollmentContractId);
        Assert.Equal(300m, (await Service.GetAllSummariesAsync(null)).Single().Balance);
    }

    // ── 11: indirim/burs tanımı borçtan düşer ────────────────────────────────
    [Fact]
    public async Task Benefit_ReducesUnpaidInstallmentsFromTheLatest()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2);
        var first = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).FirstAsync();
        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", contract.Id, first.Id, 500m, "Nakit", null), null);

        var (applied, requested) = await Service.ApplyBenefitAsync(
            contract.StudentUserId, "Ada Yılmaz", 10m, isScholarship: true, "Başarı bursu");

        Assert.Equal(100m, applied);
        Assert.Equal(100m, requested);
        var rows = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).ToListAsync();
        Assert.Equal(500m, rows[0].Amount);
        Assert.Equal(400m, rows[1].Amount);
        var saved = await db.Context.EnrollmentContracts.AsNoTracking().SingleAsync();
        Assert.Equal(900m, saved.NetAmount);
        Assert.Equal(100m, saved.ScholarshipAmount);
    }

    [Fact]
    public async Task Benefit_CannotReduceAlreadyCollectedAmount()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 1);
        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", contract.Id, null, 1_000m, "Nakit", null), null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.ApplyBenefitAsync(
            contract.StudentUserId, "Ada Yılmaz", 10m, isScholarship: false, "Kardeş indirimi"));
    }

    // ── 14: vade günü gecikme sayılmaz ───────────────────────────────────────
    [Fact]
    public void Installment_IsOverdueOnlyAfterItsDueDay()
    {
        var due = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);

        Assert.False(FinanceDates.IsOverdue(due, new DateTime(2026, 11, 1, 6, 0, 0, DateTimeKind.Utc)));
        Assert.False(FinanceDates.IsOverdue(due, new DateTime(2026, 11, 1, 20, 59, 0, DateTimeKind.Utc)));
        // Türkiye'de 2 Kasım 00:00 = 1 Kasım 21:00 UTC.
        Assert.True(FinanceDates.IsOverdue(due, new DateTime(2026, 11, 1, 21, 0, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public async Task SecondDownPaymentCollection_IsRejected()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2, downPayment: 200m, downPaymentPaid: false);

        await Service.CollectDownPaymentAsync(contract.Id, "Nakit", null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.CollectDownPaymentAsync(contract.Id, "Nakit", null));
        Assert.Single(await db.Context.FinancePayments.ToListAsync());
    }

    // ── 2: hatırlatma yalnız kendi velisine ──────────────────────────────────
    [Fact]
    public async Task OverdueReminder_GoesOnlyToTheStudentsParent_OncePerDay()
    {
        var parentId = Guid.NewGuid();
        var student = await SeedStudentAsync("Ali Can", parentId);
        await Service.CreateManualInstallmentAsync("Ali Can", 500m, DateTime.UtcNow.AddDays(-10), null);
        await SeedStudentAsync("Borcu Yok");

        var first = await Service.SendOverdueRemindersAsync();
        await Service.SendOverdueRemindersAsync();

        Assert.Equal(1, first.Notified);
        var notification = await db.Context.Notifications.SingleAsync();
        Assert.Equal(parentId, notification.TargetUserId);
        Assert.Single(push.Recipients, parentId);
        Assert.NotEqual(Guid.Empty, student.Id);
    }

    // ── 8: onay kararı ödeme durumunu ezmez ──────────────────────────────────
    [Fact]
    public async Task ApprovalBackToPending_DoesNotRejectSalary_AndPaidSalaryIsUntouched()
    {
        var pendingSalary = new AccountingSalary { Employee = "A", Role = "Öğretmen", Amount = "10.000 TL", PayDate = "01.11.2026", Status = "Planlandı" };
        var paidSalary = new AccountingSalary { Employee = "B", Role = "Öğretmen", Amount = "10.000 TL", PayDate = "01.11.2026", Status = "Ödendi" };
        db.Context.AccountingSalaries.AddRange(pendingSalary, paidSalary);
        var pendingApproval = new AccountingApproval { Title = "A", SourceType = "salary", SourceKey = pendingSalary.Id.ToString(), Status = "Onaylandı" };
        var paidApproval = new AccountingApproval { Title = "B", SourceType = "salary", SourceKey = paidSalary.Id.ToString(), Status = "Onaylandı" };
        db.Context.AccountingApprovals.AddRange(pendingApproval, paidApproval);
        await db.Context.SaveChangesAsync();

        await Accounting.UpdateApprovalStatusAsync(pendingApproval.Id, new UpdateApprovalStatusRequest("Bekliyor"));
        await Accounting.UpdateApprovalStatusAsync(paidApproval.Id, new UpdateApprovalStatusRequest("Rejected"));

        Assert.Equal("Bekliyor", (await db.Context.AccountingSalaries.AsNoTracking().SingleAsync(x => x.Id == pendingSalary.Id)).Status);
        Assert.Equal("Ödendi", (await db.Context.AccountingSalaries.AsNoTracking().SingleAsync(x => x.Id == paidSalary.Id)).Status);
    }

    [Fact]
    public async Task ResentPaidStatus_OnFullyPaidInstallment_DoesNotInventAReceipt()
    {
        var contract = await EnrollAsync(Guid.NewGuid(), "Ada Yılmaz", 1_000m, 2);
        var installment = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).FirstAsync();
        await Service.RecordPaymentAsync(new RecordPaymentRequest(
            contract.StudentUserId, "Ada Yılmaz", contract.Id, installment.Id, 500m, "Nakit", null), null);

        await Service.UpdateInstallmentAsync(installment.Id, 600m, installment.DueDateUtc, "Ödendi", null, null);

        Assert.Single(await db.Context.FinancePayments.ToListAsync());
        var saved = await db.Context.FinanceInstallments.AsNoTracking().SingleAsync(x => x.Id == installment.Id);
        Assert.Equal("Partial", saved.Status);
        Assert.Equal(100m, saved.Amount - saved.PaidAmount);
    }

    [Fact]
    public async Task Account_ByStudentId_StillIncludesLegacyNameOnlyContract()
    {
        var student = await SeedStudentAsync("Ali Can");
        await EnrollAsync(null, "Ali Can", 1_000m, 1);

        var byId = await Service.GetAccountAsync(student.Id, "Ali Can");
        var byName = await Service.GetAccountAsync(null, "Ali Can");

        Assert.Equal(1_000m, byId.NetTotal);
        Assert.Equal(1_000m, byName.NetTotal);
    }

    [Fact]
    public async Task Reminder_FindsParentByEmail_WhenCardIsNotLinked()
    {
        var parent = new AppUser { FullName = "Veli", Username = "veli@ornek.com", PasswordHash = "x", PrimaryRole = UserRole.Parent };
        db.Context.Users.Add(parent);
        var student = await SeedStudentAsync("Ali Can");
        var card = await db.Context.Students.SingleAsync(x => x.UserId == student.Id);
        card.ParentEmail = "Veli@Ornek.com";
        await db.Context.SaveChangesAsync();
        await Service.CreateManualInstallmentAsync("Ali Can", 500m, DateTime.UtcNow.AddDays(-3), null);

        await Service.SendOverdueRemindersAsync();

        Assert.Equal(parent.Id, (await db.Context.Notifications.SingleAsync()).TargetUserId);
    }

    // ── 10: gider kuralı ─────────────────────────────────────────────────────
    [Theory]
    [InlineData("Reddedildi", false)]
    [InlineData("Bekliyor", false)]
    [InlineData("Planlandı", true)]
    [InlineData("Ödendi", true)]
    public void SalaryExpenseRule_SkipsRejectedAndUnapproved(string status, bool counts)
        => Assert.Equal(counts, FinanceExpenseRules.SalaryCountsAsExpense(status));

    // ── 14: eşzamanlı tahsilat (gerçek PostgreSQL, danışma kilidi) ───────────
    [PostgreSqlFact("COURSE_INTELLECT_POSTGRES_TEST")]
    public async Task ConcurrentCollections_OnSameInstallment_DoNotLoseUpdates()
    {
        var connectionString = Environment.GetEnvironmentVariable("COURSE_INTELLECT_POSTGRES_TEST")!;
        DbContextOptions<Infrastructure.Persistence.CourseIntellectDbContext> Options() =>
            new DbContextOptionsBuilder<Infrastructure.Persistence.CourseIntellectDbContext>().UseNpgsql(connectionString).Options;

        Guid contractId;
        var studentUserId = Guid.NewGuid();
        await using (var setup = new Infrastructure.Persistence.CourseIntellectDbContext(Options()))
        {
            await setup.Database.MigrateAsync();
            var contract = await CreatePgService(setup).CreateEnrollmentAsync(new CreateEnrollmentRequest(
                studentUserId, $"Kilit {Guid.NewGuid():N}", "9-A", "2026", 10_000m, 0, null, 0, 1,
                NextMonth, "TRY", null), null);
            contractId = contract.Id;
        }

        var tasks = Enumerable.Range(0, 10).Select(async _ =>
        {
            await using var context = new Infrastructure.Persistence.CourseIntellectDbContext(Options());
            return await CreatePgService(context).RecordPaymentAsync(new RecordPaymentRequest(
                studentUserId, "Kilit", contractId, null, 100m, "Nakit", null), null);
        });
        var receipts = await Task.WhenAll(tasks);

        await using var verify = new Infrastructure.Persistence.CourseIntellectDbContext(Options());
        var installment = await verify.FinanceInstallments.AsNoTracking().SingleAsync(x => x.EnrollmentContractId == contractId);
        Assert.Equal(1_000m, installment.PaidAmount);
        Assert.Equal(10, receipts.Select(x => x.ReceiptNo).Distinct().Count());
        Assert.Equal(1_000m, await verify.FinancePaymentAllocations.AsNoTracking()
            .Where(x => x.FinanceInstallmentId == installment.Id).SumAsync(x => x.Amount));
    }

    private StudentFinanceService CreatePgService(Infrastructure.Persistence.CourseIntellectDbContext context) => new(
        context,
        new ParentNotifier(context, push),
        new NoopAuditLog(),
        new InstitutionProfileService(context, new EmptyTenantContext(), new NoopAuditLog()));

    private sealed class RecordingPush : IPushNotificationService
    {
        public List<Guid> Recipients { get; } = [];
        public bool IsConfigured => true;

        public Task SendToUserAsync(Guid userId, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
        {
            Recipients.Add(userId);
            return Task.CompletedTask;
        }

        public Task SendToUserByNameAsync(string fullName, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SendToRoleAsync(string role, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
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
