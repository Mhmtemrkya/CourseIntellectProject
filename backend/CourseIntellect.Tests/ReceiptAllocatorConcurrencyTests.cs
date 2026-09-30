using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class ReceiptAllocatorConcurrencyTests : IDisposable
{
    private readonly string databasePath = Path.Combine(Path.GetTempPath(), $"receipt-{Guid.NewGuid():N}.db");

    [Fact]
    public async Task SeparateProviderContexts_AllocateUniqueContiguousReceiptNumbersConcurrently()
    {
        await using (var setup = CreateContext())
            await setup.Database.EnsureCreatedAsync();

        var tasks = Enumerable.Range(0, 20).Select(async _ =>
        {
            await using var context = CreateContext();
            return await CreateService(context).NextReceiptNumberAsync();
        });

        var receipts = await Task.WhenAll(tasks);
        Assert.Equal(20, receipts.Distinct().Count());
        Assert.Equal(Enumerable.Range(1, 20), receipts
            .Select(x => int.Parse(x[^5..]))
            .OrderBy(x => x));
    }





    private CourseIntellectDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>()
            .UseSqlite($"Data Source={databasePath};Default Timeout=10;Pooling=False")
            .Options;
        return new CourseIntellectDbContext(options);
    }

    private static StudentFinanceService CreateService(CourseIntellectDbContext context)
    {
        var audit = new NoopAuditLog();
        return new StudentFinanceService(context, new NoopParentNotifier(), audit,
            new InstitutionProfileService(context, new EmptyTenantContext(), audit));
    }

    public void Dispose()
    {
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

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
