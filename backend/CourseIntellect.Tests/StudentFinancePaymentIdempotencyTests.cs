using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Tahsilatta çift kayıt koruması.
///
/// Para hareketinin tazmini yok: kullanıcı iki kez tıklarsa ya da ağ hatasında
/// istek yeniden gönderilirse öğrenciden iki kez tahsilat GÖRÜNMEMELİ. Koruma
/// istemciye bırakılamaz; sunucu aynı istek kimliğini ikinci kez yazmaz.
/// </summary>
public sealed class StudentFinancePaymentIdempotencyTests : IDisposable
{
    private readonly TestDb db = new();

    private StudentFinanceService Service => new(
        db.Context,
        new NoopParentNotifier(),
        new NoopAuditLog(),
        new InstitutionProfileService(db.Context, new EmptyTenantContext(), new NoopAuditLog()));

    [Fact]
    public async Task SameClientRequestId_RecordsPaymentOnlyOnce()
    {
        var service = Service;
        var contract = await CreateContractAsync(service, net: 1_000m, installments: 2);
        var requestId = Guid.NewGuid();

        var first = await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 400m, "Nakit", null, null, requestId), null);
        // Aynı pencereden ikinci tıklama / ağ tekrarı.
        var second = await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 400m, "Nakit", null, null, requestId), null);

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(first.ReceiptNo, second.ReceiptNo);
        Assert.Equal(1, await db.Context.FinancePayments.CountAsync());
        // Taksit YALNIZ bir kez mahsup edilmiş olmalı.
        var installments = await db.Context.FinanceInstallments.OrderBy(x => x.SeqNo).ToListAsync();
        Assert.Equal(400m, installments.Sum(x => x.PaidAmount));
    }

    [Fact]
    public async Task DifferentClientRequestIds_RecordSeparatePayments()
    {
        var service = Service;
        var contract = await CreateContractAsync(service, net: 1_000m, installments: 2);

        await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 400m, "Nakit", null, null, Guid.NewGuid()), null);
        await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 250m, "Kart", null, null, Guid.NewGuid()), null);

        Assert.Equal(2, await db.Context.FinancePayments.CountAsync());
        var installments = await db.Context.FinanceInstallments.ToListAsync();
        Assert.Equal(650m, installments.Sum(x => x.PaidAmount));
    }

    [Fact]
    public async Task MissingClientRequestId_KeepsLegacyBehaviour()
    {
        // Kimlik göndermeyen eski istemci/dış çağrı engellenmez.
        var service = Service;
        var contract = await CreateContractAsync(service, net: 1_000m, installments: 2);

        await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 100m, "Nakit", null), null);
        await service.RecordPaymentAsync(new RecordPaymentRequest(
            null, "Ada Yılmaz", contract.Id, null, 100m, "Nakit", null), null);

        Assert.Equal(2, await db.Context.FinancePayments.CountAsync());
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
