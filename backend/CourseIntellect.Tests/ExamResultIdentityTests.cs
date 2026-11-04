using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Sınav sonuçları öğrenci kimliğine bağlanır: aynı adlı iki öğrencinin sonuçları
/// karışmaz, veli/öğrenci kapsamı adın "içinde geçmesine" göre genişlemez.
/// </summary>
public sealed class ExamResultIdentityTests : IDisposable
{
    private readonly TestDb db = new();
    private static readonly Guid Tenant = Guid.NewGuid();

    private sealed class NoopHasher : IPasswordHasher
    {
        public string Hash(string password) => password;
        public bool Verify(string password, string passwordHash) => password == passwordHash;
    }

    private sealed class RecordingNotifier : IParentNotifier
    {
        public List<Guid?> StudentUserIds { get; } = [];

        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyStudentParentAsync(Guid? studentUserId, string studentName, string title, string message, string category, string? dedupeKey, CancellationToken cancellationToken = default)
        {
            StudentUserIds.Add(studentUserId);
            return Task.CompletedTask;
        }
    }

    private sealed class NoopAuditLog : IAuditLogService
    {
        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int take, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class FixedTenantContext(Guid? tenantId) : ITenantContext
    {
        public Guid? CurrentTenantId { get; } = tenantId;
        public bool HasTenant => CurrentTenantId.HasValue;
    }

    private readonly RecordingNotifier notifier = new();

    private AcademicQueryService Service()
    {
        if (!db.Context.TenantWorkspaces.Any(x => x.Id == Tenant))
        {
            db.Context.TenantWorkspaces.Add(new TenantWorkspace { Id = Tenant, Name = "Okul", Slug = $"okul-{Tenant:N}" });
            db.Context.SaveChanges();
        }
        db.Context.SetTenantOverride(Tenant);
        return new AcademicQueryService(db.Context, new NoopHasher(), new UsernameGenerator(db.Context), new FixedTenantContext(Tenant), notifier, new NoopAuditLog());
    }

    private async Task<(StudentProfile First, StudentProfile Second)> SeedTwinsAsync()
    {
        Service();
        var first = new StudentProfile { TenantId = Tenant, UserId = Guid.NewGuid(), FullName = "Ali Kaya", ClassName = "10-A" };
        var second = new StudentProfile { TenantId = Tenant, UserId = Guid.NewGuid(), FullName = "Ali Kaya", ClassName = "10-A" };
        db.Context.Students.AddRange(first, second);
        await db.Context.SaveChangesAsync();
        return (first, second);
    }

    private static CreateExamResultRequest Request(string name, int score, Guid? studentId = null, string title = "1. Deneme") =>
        new(title, "MockExam", "Matematik", "01.11.2026", name, "10-A", score, 0m, StudentId: studentId);

    [Fact]
    public async Task Create_WithId_LinksTwinAndNotifiesThatTwinsParent()
    {
        var (_, second) = await SeedTwinsAsync();

        var created = await Service().CreateExamResultAsync(Request("Ali Kaya", 80, second.Id));

        Assert.Equal(second.Id, created.StudentId);
        Assert.Equal(second.UserId, Assert.Single(notifier.StudentUserIds));
    }

    [Fact]
    public async Task Create_ByName_LinksUniqueAndLeavesAmbiguousUnlinked()
    {
        await SeedTwinsAsync();
        Service();
        var ayse = new StudentProfile { TenantId = Tenant, UserId = Guid.NewGuid(), FullName = "Ayşe Demir", ClassName = "10-A" };
        db.Context.Students.Add(ayse);
        await db.Context.SaveChangesAsync();
        var service = Service();

        var linked = await service.CreateExamResultAsync(Request("ayşe demir", 70));
        var ambiguous = await service.CreateExamResultAsync(Request("Ali Kaya", 60));

        Assert.Equal(ayse.Id, linked.StudentId);
        Assert.Null(ambiguous.StudentId);
    }

    [Fact]
    public async Task Get_Scope_HidesSameNamedOtherFamilyChild()
    {
        var (first, second) = await SeedTwinsAsync();
        var service = Service();
        await service.CreateExamResultAsync(Request("Ali Kaya", 90, first.Id));
        await service.CreateExamResultAsync(Request("Ali Kaya", 40, second.Id));

        var visible = await service.GetExamResultsAsync(null, null, scope: new StudentRecordScope([first.Id], ["Ali KAYA"]));

        var row = Assert.Single(visible);
        Assert.Equal(90, row.Score);
    }

    [Fact]
    public async Task Get_ScopedName_MatchesExactly_NotByContains()
    {
        var service = Service();
        // Profili olmayan (bağlanamayan) eski sonuçlar: ad eşleşmesine düşer.
        await service.CreateExamResultAsync(Request("Ali Kaya", 75));
        await service.CreateExamResultAsync(Request("Ali Kayaoğlu", 55));

        var visible = await service.GetExamResultsAsync("Ali Kaya", null, scope: new StudentRecordScope([], ["Ali Kaya"]));

        Assert.Equal(75, Assert.Single(visible).Score);
    }

    public void Dispose() => db.Dispose();
}
