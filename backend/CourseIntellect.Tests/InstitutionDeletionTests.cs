using CourseIntellect.Application.DTOs.AccountLifecycle;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Tests;

public sealed class InstitutionDeletionTests
{
    private static readonly Guid Tenant = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static TestDb NewDb()
    {
        var db = new TestDb();
        db.Context.Set<TenantWorkspace>().Add(new TenantWorkspace
        {
            Id = Tenant, Name = "Kurum", Slug = "kurum", ContactEmail = "k@e.co", Plan = "free", Status = "active",
        });
        db.Context.SaveChanges();
        return db;
    }

    private static InstitutionDeletionService NewService(TestDb db)
        => new(db.Context, new FakeHasher(), new FakeTenant(Tenant), new NoopAudit(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InstitutionDeletion:GracePeriodDays"] = "7",
            }).Build());

    private static AppUser Admin()
        => new() { Id = Guid.NewGuid(), TenantId = Tenant, FullName = "Yönetici", Username = $"a-{Guid.NewGuid():N}"[..10], PasswordHash = "correct-password", PrimaryRole = UserRole.Admin, Status = UserStatus.Active };

    [Fact]
    public async Task NonAdmin_CannotRequest()
    {
        using var db = NewDb();
        var teacher = Admin();
        teacher.PrimaryRole = UserRole.Teacher;
        db.Context.Users.Add(teacher);
        await db.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            NewService(db).RequestAsync(teacher.Id, "T", new CreateInstitutionDeletionRequest { Password = "correct-password", Confirm = true }));
    }

    [Fact]
    public async Task Request_CreatesPendingApproval_WithImpact()
    {
        using var db = NewDb();
        var admin = Admin();
        db.Context.Users.Add(admin);
        db.Context.Students.Add(new StudentProfile { TenantId = Tenant, UserId = Guid.NewGuid(), FullName = "Öğrenci" });
        await db.Context.SaveChangesAsync();

        var status = await NewService(db).RequestAsync(admin.Id, "Yönetici",
            new CreateInstitutionDeletionRequest { Password = "correct-password", Confirm = true });

        Assert.Equal("PendingPlatformApproval", status.Status);
        Assert.NotNull(status.Impact);
        Assert.True(status.Impact!.UserCount >= 1);
        Assert.Equal(1, status.Impact.StudentCount);
    }

    [Fact]
    public async Task Decide_RejectWithoutReason_Throws_ApproveSchedules()
    {
        using var db = NewDb();
        var admin = Admin();
        db.Context.Users.Add(admin);
        await db.Context.SaveChangesAsync();
        var service = NewService(db);
        var created = await service.RequestAsync(admin.Id, "Yönetici",
            new CreateInstitutionDeletionRequest { Password = "correct-password", Confirm = true });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.DecideAsync(created.Id!.Value, Guid.NewGuid(), "Platform", new InstitutionDeletionDecisionRequest { Approve = false }));

        var approved = await service.DecideAsync(created.Id!.Value, Guid.NewGuid(), "Platform",
            new InstitutionDeletionDecisionRequest { Approve = true });
        Assert.Equal("Scheduled", approved.Status);
        Assert.NotNull(approved.FinalizeAtUtc);
        Assert.True(approved.FinalizeAtUtc > DateTime.UtcNow);
    }

    [Fact]
    public async Task Finalize_DeIdentifiesUsersAndFinance()
    {
        using var db = NewDb();
        var admin = Admin();
        db.Context.Users.Add(admin);
        db.Context.FinancePayments.Add(new FinancePayment { TenantId = Tenant, StudentName = "Ali Veli", Amount = 500m, ReceiptNo = "R-9" });
        await db.Context.SaveChangesAsync();

        await new AccountLifecycleService(db.Context).FinalizeInstitutionDeletionAsync(Tenant);
        db.Context.ChangeTracker.Clear();

        var u = await db.Context.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == admin.Id);
        Assert.Equal(AccountLifecycleService.Tombstone, u.FullName);
        Assert.NotNull(u.DeletedAtUtc);
        Assert.Equal(string.Empty, u.PasswordHash);

        var pay = await db.Context.FinancePayments.IgnoreQueryFilters().FirstAsync();
        Assert.Equal(AccountLifecycleService.Tombstone, pay.StudentName);
        Assert.Equal(500m, pay.Amount); // finans satırı korunur
    }

    [Fact]
    public async Task Finalize_PurgesOperationalTables_RetainsAnonymizedFinance_NoFkErrors()
    {
        using var db = NewDb();
        var admin = Admin();
        db.Context.Users.Add(admin);
        // Retain edilmesi gereken (anonimleşir, kalır):
        db.Context.FinancePayments.Add(new FinancePayment { TenantId = Tenant, StudentName = "Ali Veli", Amount = 750m, ReceiptNo = "R-1" });
        db.Context.ExamResults.Add(new ExamResult { TenantId = Tenant, StudentName = "Ali Veli", Score = 60 });
        // Purge edilmesi gereken operasyonel tablolar:
        db.Context.ContentItems.Add(new ContentItem { TenantId = Tenant, Title = "Ders", Subject = "Mat", Teacher = "Öğretmen" });
        db.Context.Set<LibraryBook>().Add(new LibraryBook { TenantId = Tenant, Title = "Kitap", Author = "Yazar", Isbn = "123" });
        db.Context.Notifications.Add(new NotificationItem { TenantId = Tenant, Title = "Bildirim", Message = "x" });
        var thread = new MessageThread { TenantId = Tenant, ParticipantOneUserId = admin.Id, ParticipantTwoUserId = Guid.NewGuid() };
        db.Context.MessageThreads.Add(thread);
        db.Context.MessageItems.Add(new MessageItem { TenantId = Tenant, ThreadId = thread.Id, SenderUserId = admin.Id });
        await db.Context.SaveChangesAsync();

        await new AccountLifecycleService(db.Context).FinalizeInstitutionDeletionAsync(Tenant); // FK hatası ATMAMALI
        db.Context.ChangeTracker.Clear();

        // Operasyonel tablolar PURGE edildi.
        Assert.Equal(0, await db.Context.ContentItems.IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await db.Context.Set<LibraryBook>().IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await db.Context.Notifications.IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await db.Context.MessageItems.IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await db.Context.MessageThreads.IgnoreQueryFilters().CountAsync());

        // Finans/eğitim RETAIN edildi (anonim), kullanıcı anonim + erişim kapalı.
        var pay = await db.Context.FinancePayments.IgnoreQueryFilters().FirstAsync();
        Assert.Equal(AccountLifecycleService.Tombstone, pay.StudentName);
        Assert.Equal(750m, pay.Amount);
        Assert.Equal(1, await db.Context.ExamResults.IgnoreQueryFilters().CountAsync());
        Assert.NotNull((await db.Context.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == admin.Id)).DeletedAtUtc);
    }

    [Fact]
    public async Task Finalize_DoesNotTouchOtherTenants()
    {
        var other = Guid.Parse("33333333-3333-3333-3333-333333333333");
        using var db = NewDb();
        db.Context.Set<TenantWorkspace>().Add(new TenantWorkspace
        {
            Id = other, Name = "Diğer", Slug = "diger", ContactEmail = "d@e.co", Plan = "free", Status = "active",
        });
        // A kurumu (silinecek)
        db.Context.Users.Add(new AppUser { Id = Guid.NewGuid(), TenantId = Tenant, FullName = "A Kullanıcı", Username = $"a-{Guid.NewGuid():N}"[..10], PasswordHash = "x", PrimaryRole = UserRole.Teacher, Status = UserStatus.Active });
        db.Context.FinancePayments.Add(new FinancePayment { TenantId = Tenant, StudentName = "A Öğrenci", Amount = 100m, ReceiptNo = "A-1" });
        // B kurumu (korunmalı)
        var bUser = new AppUser { Id = Guid.NewGuid(), TenantId = other, FullName = "B Kullanıcı", Username = $"b-{Guid.NewGuid():N}"[..10], PasswordHash = "secret", PrimaryRole = UserRole.Teacher, Status = UserStatus.Active };
        db.Context.Users.Add(bUser);
        db.Context.FinancePayments.Add(new FinancePayment { TenantId = other, StudentName = "B Öğrenci", Amount = 200m, ReceiptNo = "B-1" });
        await db.Context.SaveChangesAsync();

        await new AccountLifecycleService(db.Context).FinalizeInstitutionDeletionAsync(Tenant);
        db.Context.ChangeTracker.Clear();

        // B kurumu HİÇ etkilenmemeli (anonimleştirilmemiş, silinmemiş, parola duruyor).
        var bReloaded = await db.Context.Users.IgnoreQueryFilters().FirstAsync(x => x.Id == bUser.Id);
        Assert.NotEqual(AccountLifecycleService.Tombstone, bReloaded.FullName);
        Assert.Null(bReloaded.DeletedAtUtc);
        Assert.Equal("secret", bReloaded.PasswordHash);
        var bPay = await db.Context.FinancePayments.IgnoreQueryFilters().FirstAsync(x => x.TenantId == other);
        Assert.Equal("B Öğrenci", bPay.StudentName);
    }

    [Fact]
    public async Task Finalizer_CompletesDueInstitution_RequestRowSurvivesAsCompleted()
    {
        using var db = NewDb();
        db.Context.Users.Add(Admin());
        db.Context.ContentItems.Add(new ContentItem { TenantId = Tenant, Title = "x", Subject = "y", Teacher = "z" });
        var request = new InstitutionDeletionRequest
        {
            TenantId = Tenant,
            RequestedByUserId = Guid.NewGuid(),
            Status = InstitutionDeletionStatus.Scheduled,
            FinalizeAtUtc = DateTime.UtcNow.AddMinutes(-1),
            ImpactSnapshotJson = "{}",
        };
        db.Context.Set<InstitutionDeletionRequest>().Add(request);
        await db.Context.SaveChangesAsync();

        // Finalizer yolu: purge InstitutionDeletionRequest'i SİLMEMELİ, sonra Completed yazılmalı.
        await AccountDeletionFinalizerService.ProcessDueInstitutionDeletionsAsync(
            db.Context, new AccountLifecycleService(db.Context), DateTime.UtcNow);
        db.Context.ChangeTracker.Clear();

        var reloaded = await db.Context.Set<InstitutionDeletionRequest>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == request.Id);
        Assert.NotNull(reloaded); // satır purge'de silinmemeli
        Assert.Equal(InstitutionDeletionStatus.Completed, reloaded!.Status);
        Assert.NotNull(reloaded.CompletedAtUtc);
        Assert.Equal(0, await db.Context.ContentItems.IgnoreQueryFilters().CountAsync()); // operasyonel veri gitti
    }

    private sealed class FakeHasher : IPasswordHasher
    {
        public string Hash(string password) => password;
        public bool Verify(string password, string passwordHash) => password == passwordHash;
    }

    private sealed class FakeTenant(Guid tenantId) : ITenantContext
    {
        public Guid? CurrentTenantId { get; } = tenantId;
        public bool HasTenant => true;
    }

    private sealed class NoopAudit : IAuditLogService
    {
        public Task LogAsync(Guid? a, string b, string c, string d, string e, string f, string g, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogAsync(string a, string b, string c, string d, string e, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogChangeAsync(string a, string b, string c, string d, string e, object? before, object? after, CancellationToken ct = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? c, int t, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<AuditLogDto>>([]);
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery q, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlyList<AuditBranchSummaryDto>>([]);
    }
}
