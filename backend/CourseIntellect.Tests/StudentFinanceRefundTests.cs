using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class StudentFinanceRefundTests : IDisposable
{
    private readonly TestDb db = new();
    private StudentFinanceService Service => new(db.Context, new NoopParentNotifier(), new NoopAuditLog());

    [Fact]
    public async Task PaymentReversal_IsBoundToReceipt_AndReversesExactLastAllocation()
    {
        var service = Service;
        var contract = await CreateContractAsync(service, net: 1_000m, installments: 2);
        var payment = await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 800m, "Nakit", null), null);

        await service.RefundPaymentAsync(new RefundRequest(
            payment.Id, 200m, "PaymentReversal", "Yanlış tahsilat", "Nakit", null), null);

        var rows = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).ToListAsync();
        Assert.Equal(500m, rows[0].PaidAmount);
        Assert.Equal(100m, rows[1].PaidAmount);
        var refund = await db.Context.FinancePayments.SingleAsync(x => x.EntryType == "Refund");
        Assert.Equal(payment.Id, refund.OriginalPaymentId);
        Assert.Equal(-200m, refund.Amount);
        Assert.Equal("Yanlış tahsilat", refund.RefundReason);
    }

    [Fact]
    public async Task Refund_CannotExceedReceiptRemainingAmount()
    {
        var service = Service;
        var contract = await CreateContractAsync(service, 500m, 1);
        var payment = await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 500m, "Kart", null), null);
        await service.RefundPaymentAsync(new RefundRequest(
            payment.Id, 300m, "PaymentReversal", "İlk iade", "Karta İade", "POS-1"), null);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.RefundPaymentAsync(
            new RefundRequest(payment.Id, 201m, "PaymentReversal", "Fazla iade", "Karta İade", "POS-2"), null));

        Assert.Contains("en fazla 200", error.Message);
    }

    [Fact]
    public async Task AdvanceReturn_DoesNotReopenInstallments()
    {
        var service = Service;
        var contract = await CreateContractAsync(service, 1_000m, 2);
        var payment = await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 1_200m, "Havale", null), null);

        await service.RefundPaymentAsync(new RefundRequest(
            payment.Id, 150m, "AdvanceReturn", "Fazla yatırıldı", "Havale/EFT", "BANK-1"), null);

        var rows = await db.Context.FinanceInstallments.ToListAsync();
        Assert.All(rows, row => Assert.Equal(row.Amount, row.PaidAmount));
    }

    [Fact]
    public async Task ContractReduction_ReducesContractAndPaymentWithoutCreatingDebt()
    {
        var service = Service;
        var contract = await CreateContractAsync(service, 1_000m, 2);
        var payment = await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 1_000m, "Nakit", null), null);

        await service.RefundPaymentAsync(new RefundRequest(
            payment.Id, 200m, "ContractReduction", "Yeni indirim", "Nakit", null), null);

        var account = await service.GetAccountAsync(null, "Ada Yılmaz");
        Assert.Equal(800m, account.NetTotal);
        Assert.Equal(800m, account.PaidTotal);
        Assert.Equal(0m, account.Balance);
    }

    [Fact]
    public async Task DownPaymentPartialRefund_ChangesStatusToPartial()
    {
        var service = Service;
        var contract = await service.CreateEnrollmentAsync(new CreateEnrollmentRequest(
            null, "Ada Yılmaz", "10-A", "2026", 1_000m, 0, null, 400m, 1,
            DateTime.UtcNow.AddMonths(1), "TRY", null, "Nakit", true), null);
        var downPayment = await db.Context.FinancePayments.SingleAsync(x => x.Note == "Kayıt peşinatı");

        await service.RefundPaymentAsync(new RefundRequest(
            downPayment.Id, 100m, "PaymentReversal", "Peşinat düzeltmesi", "Nakit", null), null);

        var account = await service.GetAccountAsync(null, "Ada Yılmaz");
        var updated = Assert.Single(account.Contracts);
        Assert.Equal(300m, updated.DownPaymentPaidAmount);
        Assert.Equal("Kısmi", updated.DownPaymentStatus);
        Assert.False(updated.DownPaymentPaid);
        Assert.Equal(contract.Id, updated.Id);
    }

    private static Task<EnrollmentContractDto> CreateContractAsync(
        StudentFinanceService service,
        decimal net,
        int installments) => service.CreateEnrollmentAsync(new CreateEnrollmentRequest(
            null, "Ada Yılmaz", "10-A", "2026", net, 0, null, 0, installments,
            DateTime.UtcNow.AddMonths(1), "TRY", null), null);

    public void Dispose() => db.Dispose();

    private sealed class NoopParentNotifier : IParentNotifier
    {
        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
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
