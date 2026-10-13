using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
namespace CourseIntellect.Tests;
public sealed class DeletionReviewRegressionTests
{
    [Fact]
    public async Task LegacyTeacherAuthorship_ClearsTeacherName_PreservesSharedMaterial()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        user.PrimaryRole = UserRole.Teacher;
        db.Context.ContentItems.Add(new ContentItem { TenantId = tenant, Teacher = user.FullName, Title = "Shared lesson", FileUrl = "/uploads/material/shared.pdf" });
        await db.Context.SaveChangesAsync();
        // Shared teaching material must survive a teacher's personal account deletion.
        await new AccountLifecycleService(db.Context, new FailingStorage()).FinalizeAccountDeletionAsync(tenant, user.Id);
        db.Context.ChangeTracker.Clear();
        var material = await db.Context.ContentItems.IgnoreQueryFilters().SingleAsync();
        Assert.Equal("Shared lesson", material.Title);
        Assert.Equal("/uploads/material/shared.pdf", material.FileUrl);
        Assert.NotEqual(user.FullName, material.Teacher);
    }

    [Fact]
    public async Task InstitutionInvoice_PreservesAmount_ClearsCounterpartyAndNotes()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        db.Context.Set<AccountingInvoice>().Add(new AccountingInvoice { TenantId = tenant, InvoiceNumber = "TEST-1", Counterparty = user.FullName, Amount = "1250.00", Note = "Private identity", Subtitle = "Private address" });
        await db.Context.SaveChangesAsync();
        await new AccountLifecycleService(db.Context, new RecordingStorage()).FinalizeInstitutionDeletionAsync(tenant);
        db.Context.ChangeTracker.Clear();
        var invoice = await db.Context.Set<AccountingInvoice>().IgnoreQueryFilters().SingleAsync();
        Assert.Equal("1250.00", invoice.Amount);
        Assert.Equal("TEST-1", invoice.InvoiceNumber);
        Assert.Empty(invoice.Counterparty);
        Assert.Empty(invoice.Note);
        Assert.Empty(invoice.Subtitle);
    }

    private static (TestDb db, Guid tenant, AppUser user) Seed()
    {
        var db = new TestDb(); var tenant = Guid.NewGuid();
        db.Context.Set<TenantWorkspace>().Add(new TenantWorkspace { Id = tenant, Name = "Audit Test", Slug = tenant.ToString("N"), ContactName = "Private Contact", ContactEmail = "private@example.test" });
        var user = new AppUser { TenantId = tenant, FullName = "Test Person", Username = "private-person", PasswordHash = "hash", PrimaryRole = UserRole.Student };
        db.Context.Users.Add(user); db.Context.SaveChanges();
        return (db, tenant, user);
    }
    [Fact]
    public async Task PersonalDeletion_ShouldRemoveQuestionUsernameAndAttachments()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        var question = new StudentQuestionThread { TenantId = tenant, StudentUserId = user.Id, StudentUsername = "private-person", QuestionText = "Private text", AttachmentsSerialized = "[{\"FileUrl\":\"/uploads/questions/private.pdf\"}]" };
        db.Context.StudentQuestionThreads.Add(question); await db.Context.SaveChangesAsync();
        await new AccountLifecycleService(db.Context, new RecordingStorage()).FinalizeAccountDeletionAsync(tenant, user.Id);
        db.Context.ChangeTracker.Clear();
        var retained = await db.Context.StudentQuestionThreads.IgnoreQueryFilters().SingleAsync();
        Assert.NotEqual("private-person", retained.StudentUsername);
        Assert.Empty(retained.QuestionText);
        Assert.Equal("[]", retained.AttachmentsSerialized);
    }
    [Fact]
    public async Task FailedPhotoDeletion_ShouldNotMarkRequestCompleted()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        user.PhotoUrl = "/uploads/avatars/private.png";
        db.Context.Set<AccountDeletionRequest>().Add(new AccountDeletionRequest { TenantId = tenant, UserId = user.Id, Status = AccountDeletionStatus.Pending, FinalizeAtUtc = DateTime.UtcNow.AddMinutes(-1) });
        await db.Context.SaveChangesAsync();
        await AccountDeletionFinalizerService.ProcessDueAccountDeletionsAsync(db.Context, new AccountLifecycleService(db.Context, new FailingStorage()), null, DateTime.UtcNow);
        db.Context.ChangeTracker.Clear();
        Assert.NotEqual(AccountDeletionStatus.Completed, (await db.Context.Set<AccountDeletionRequest>().IgnoreQueryFilters().SingleAsync()).Status);
    }
    [Fact]
    public async Task InstitutionDeletion_ShouldClearPersonalContactAndUsername()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        await new AccountLifecycleService(db.Context, new FailingStorage()).FinalizeInstitutionDeletionAsync(tenant);
        db.Context.ChangeTracker.Clear();
        Assert.NotEqual("private-person", (await db.Context.Users.IgnoreQueryFilters().SingleAsync()).Username);
        Assert.NotEqual("private@example.test", (await db.Context.Set<TenantWorkspace>().SingleAsync()).ContactEmail);
    }
    [Fact]
    public async Task FailedCleanup_PersistsUrls_RetriesAndThenCompletes()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        user.PhotoUrl = "/uploads/avatars/retry.png";
        db.Context.Set<AccountDeletionRequest>().Add(new AccountDeletionRequest { TenantId = tenant, UserId = user.Id, FinalizeAtUtc = DateTime.UtcNow.AddMinutes(-1) });
        await db.Context.SaveChangesAsync();
        await AccountDeletionFinalizerService.ProcessDueAccountDeletionsAsync(db.Context, new AccountLifecycleService(db.Context, new FailingStorage()), null, DateTime.UtcNow);
        Assert.Equal("/uploads/avatars/retry.png", (await db.Context.Set<DeletionFileTask>().IgnoreQueryFilters().SingleAsync()).FileUrl);
        await AccountDeletionFinalizerService.ProcessDueAccountDeletionsAsync(db.Context, new AccountLifecycleService(db.Context, new RecordingStorage()), null, DateTime.UtcNow);
        Assert.Equal(AccountDeletionStatus.Completed, (await db.Context.Set<AccountDeletionRequest>().IgnoreQueryFilters().SingleAsync()).Status);
        Assert.Empty(await db.Context.Set<DeletionFileTask>().IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task SharedUpload_OtherTenantReference_IsPreserved()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        user.PhotoUrl = "/uploads/avatars/shared.png";
        var otherTenant = Guid.NewGuid();
        db.Context.Set<TenantWorkspace>().Add(new TenantWorkspace { Id = otherTenant, Name = "Other", Slug = otherTenant.ToString("N") });
        db.Context.Users.Add(new AppUser { TenantId = otherTenant, Username = "other", FullName = "Other Person", PasswordHash = "hash", PhotoUrl = user.PhotoUrl });
        await db.Context.SaveChangesAsync();
        // Failing storage proves no physical delete is attempted while another tenant owns this upload.
        await new AccountLifecycleService(db.Context, new FailingStorage()).FinalizeAccountDeletionAsync(tenant, user.Id);
        db.Context.ChangeTracker.Clear();
        Assert.Equal("/uploads/avatars/shared.png", (await db.Context.Users.IgnoreQueryFilters().SingleAsync(x => x.TenantId == otherTenant)).PhotoUrl);
    }

    [Fact]
    public async Task InstitutionFileFailure_RetryKeepsPendingTasks()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        db.Context.ContentItems.Add(new ContentItem { TenantId = tenant, FileUrl = "/uploads/material/private.pdf", Title = "Material" });
        db.Context.Set<InstitutionDeletionRequest>().Add(new InstitutionDeletionRequest { TenantId = tenant, RequestedByUserId = user.Id, Status = InstitutionDeletionStatus.Scheduled, FinalizeAtUtc = DateTime.UtcNow.AddMinutes(-1) });
        await db.Context.SaveChangesAsync();
        await AccountDeletionFinalizerService.ProcessDueInstitutionDeletionsAsync(db.Context, new AccountLifecycleService(db.Context, new FailingStorage()), DateTime.UtcNow);
        Assert.Equal(InstitutionDeletionStatus.Failed, (await db.Context.Set<InstitutionDeletionRequest>().IgnoreQueryFilters().SingleAsync()).Status);
        Assert.Single(await db.Context.Set<DeletionFileTask>().IgnoreQueryFilters().ToListAsync());
        await AccountDeletionFinalizerService.ProcessDueInstitutionDeletionsAsync(db.Context, new AccountLifecycleService(db.Context, new RecordingStorage()), DateTime.UtcNow);
        Assert.Equal(InstitutionDeletionStatus.Completed, (await db.Context.Set<InstitutionDeletionRequest>().IgnoreQueryFilters().SingleAsync()).Status);
        Assert.Empty(await db.Context.Set<DeletionFileTask>().IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task CompletionPush_IsSentOnlyAfterSuccessfulCleanup_AndSnapshotIsCleared()
    {
        var (db, tenant, user) = Seed(); using var scope = db;
        user.PhotoUrl = "/uploads/avatars/push.png";
        db.Context.PushDeviceRegistrations.Add(new PushDeviceRegistration { TenantId = tenant, UserId = user.Id, Token = "synthetic-token" });
        db.Context.Set<AccountDeletionRequest>().Add(new AccountDeletionRequest { TenantId = tenant, UserId = user.Id, FinalizeAtUtc = DateTime.UtcNow.AddMinutes(-1) });
        await db.Context.SaveChangesAsync();
        var push = new RecordingPush();
        await AccountDeletionFinalizerService.ProcessDueAccountDeletionsAsync(db.Context, new AccountLifecycleService(db.Context, new FailingStorage()), push, DateTime.UtcNow);
        Assert.Empty(push.SentTokens);
        await AccountDeletionFinalizerService.ProcessDueAccountDeletionsAsync(db.Context, new AccountLifecycleService(db.Context, new RecordingStorage()), push, DateTime.UtcNow);
        Assert.Contains("synthetic-token", push.SentTokens);
        Assert.Equal("[]", (await db.Context.Set<AccountDeletionRequest>().IgnoreQueryFilters().SingleAsync()).CompletionTokensJson);
        Assert.Empty(await db.Context.PushDeviceRegistrations.IgnoreQueryFilters().ToListAsync());
    }

    private sealed class RecordingPush : IPushNotificationService
    {
        public bool IsConfigured => true;
        public List<string> SentTokens { get; } = [];
        public Task SendToTokensAsync(IReadOnlyList<string> tokens, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) { SentTokens.AddRange(tokens); return Task.CompletedTask; }
        public Task SendToUserAsync(Guid userId, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => throw new InvalidOperationException("Pre-deletion delivery is forbidden.");
        public Task SendToUserByNameAsync(string fullName, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendToRoleAsync(string role, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class RecordingStorage : IFileStorageService
    {
        public Task<UploadedAssetDto> SaveAsync(Stream s, string f, string c, string folder, string b, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<byte[]?> ReadBytesAsync(string u, CancellationToken ct = default) => Task.FromResult<byte[]?>(null);
        public Task<StoredFilePrefixDto?> ReadPrefixAsync(string u, int m, CancellationToken ct = default) => Task.FromResult<StoredFilePrefixDto?>(null);
        public Task<bool> DeleteAsync(string u, CancellationToken ct = default) => Task.FromResult(true);
    }
    private sealed class FailingStorage : IFileStorageService
    {
        public Task<UploadedAssetDto> SaveAsync(Stream s, string f, string c, string folder, string b, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<byte[]?> ReadBytesAsync(string u, CancellationToken ct = default) => Task.FromResult<byte[]?>(null);
        public Task<StoredFilePrefixDto?> ReadPrefixAsync(string u, int m, CancellationToken ct = default) => Task.FromResult<StoredFilePrefixDto?>(null);
        public Task<bool> DeleteAsync(string u, CancellationToken ct = default) => throw new IOException("Synthetic deletion failure");
    }
}
