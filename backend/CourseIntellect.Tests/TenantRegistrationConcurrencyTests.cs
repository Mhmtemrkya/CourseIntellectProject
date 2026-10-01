using System.Collections.Concurrent;
using System.Data.Common;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

public sealed class TenantRegistrationConcurrencyTests : IDisposable
{
    private readonly string databasePath = Path.Combine(Path.GetTempPath(), $"registration-concurrency-{Guid.NewGuid():N}.db");

    [Fact]
    public async Task Simultaneous_approval_has_exactly_one_claimant_and_never_overwrites_winner_credentials()
    {
        var applicationId = await SeedPendingApplicationAsync();
        var barrier = new ApplicationReadBarrier();
        var setup = new RecordingSetupDocument();

        await using var firstDb = CreateContext(barrier);
        await using var secondDb = CreateContext(barrier);
        var firstService = CreateService(firstDb, setupDocument: setup);
        var secondService = CreateService(secondDb, setupDocument: setup);

        var approvals = await Task.WhenAll(
            firstService.ApproveTenantAsync(applicationId),
            secondService.ApproveTenantAsync(applicationId));

        Assert.Single(approvals.Where(result => result is not null));
        Assert.Equal(1, setup.GeneratedCount);

        await using var assertionDb = CreateContext();
        var tenant = await assertionDb.TenantWorkspaces.SingleAsync();
        var admin = await assertionDb.Users.SingleAsync();
        var application = await assertionDb.TenantRegistrationApplications.SingleAsync();
        Assert.Equal(tenant.Id, application.CreatedTenantId);
        Assert.Equal(tenant.AdminUserId, admin.Id);
        Assert.Equal("approved", application.Status);
    }

    [SkippableFact]
    public async Task PostgreSql_simultaneous_approval_has_exactly_one_atomic_claimant()
    {
        var connectionString = Environment.GetEnvironmentVariable("COURSE_INTELLECT_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "COURSE_INTELLECT_TEST_POSTGRES tanımlı değil — gerçek PostgreSQL eşzamanlılık testi atlandı.");

        static CourseIntellectDbContext Context(string value, DbCommandInterceptor? interceptor = null)
        {
            var builder = new DbContextOptionsBuilder<CourseIntellectDbContext>().UseNpgsql(value);
            if (interceptor is not null) builder.AddInterceptors(interceptor);
            return new CourseIntellectDbContext(builder.Options);
        }

        await using (var setupDb = Context(connectionString))
        {
            await setupDb.Database.EnsureDeletedAsync();
            await setupDb.Database.EnsureCreatedAsync();
            setupDb.TenantRegistrationApplications.Add(PendingApplication());
            await setupDb.SaveChangesAsync();
        }

        Guid applicationId;
        await using (var queryDb = Context(connectionString))
        {
            applicationId = await queryDb.TenantRegistrationApplications.Select(x => x.Id).SingleAsync();
        }

        var barrier = new ApplicationReadBarrier();
        var setup = new RecordingSetupDocument();
        await using var firstDb = Context(connectionString, barrier);
        await using var secondDb = Context(connectionString, barrier);

        var approvals = await Task.WhenAll(
            CreateService(firstDb, setupDocument: setup).ApproveTenantAsync(applicationId),
            CreateService(secondDb, setupDocument: setup).ApproveTenantAsync(applicationId));

        Assert.Single(approvals.Where(result => result is not null));
        Assert.Equal(1, setup.GeneratedCount);
        await using var assertionDb = Context(connectionString);
        Assert.Single(await assertionDb.TenantWorkspaces.ToListAsync());
        Assert.Single(await assertionDb.Users.ToListAsync());
        var application = await assertionDb.TenantRegistrationApplications.SingleAsync();
        Assert.Equal("approved", application.Status);
        Assert.Equal((await assertionDb.TenantWorkspaces.SingleAsync()).Id, application.CreatedTenantId);
        await assertionDb.Database.EnsureDeletedAsync();
    }

    [Fact]
    public async Task Approval_claim_rolls_back_before_commit_and_a_fresh_context_can_retry_safely()
    {
        var applicationId = await SeedPendingApplicationAsync();

        await using (var failingDb = CreateContext())
        {
            var failingService = CreateService(failingDb, setupDocument: new ThrowingSetupDocument());
            await Assert.ThrowsAsync<InvalidOperationException>(() => failingService.ApproveTenantAsync(applicationId));
        }

        await using (var afterRollback = CreateContext())
        {
            var application = await afterRollback.TenantRegistrationApplications.SingleAsync();
            Assert.Equal("pending", application.Status);
            Assert.Null(application.CreatedTenantId);
            Assert.Empty(await afterRollback.TenantWorkspaces.ToListAsync());
            Assert.Empty(await afterRollback.Users.ToListAsync());
        }

        await using (var retryDb = CreateContext())
        {
            var retry = await CreateService(retryDb, setupDocument: new RecordingSetupDocument())
                .ApproveTenantAsync(applicationId);
            Assert.NotNull(retry?.TemporaryPassword);
        }

        await using var assertionDb = CreateContext();
        Assert.Single(await assertionDb.TenantWorkspaces.ToListAsync());
        Assert.Single(await assertionDb.Users.ToListAsync());
    }

    [Fact]
    public async Task Post_commit_response_loss_retry_redelivers_for_the_created_tenant_only()
    {
        var applicationId = await SeedPendingApplicationAsync();
        Guid createdTenantId;
        string firstPassword;

        await using (var firstDb = CreateContext())
        {
            var first = await CreateService(firstDb, setupDocument: new RecordingSetupDocument())
                .ApproveTenantAsync(applicationId);
            createdTenantId = first!.Id;
            firstPassword = first.TemporaryPassword!;
        }

        await using (var retryDb = CreateContext())
        {
            var retry = await CreateService(retryDb, setupDocument: new RecordingSetupDocument())
                .ApproveTenantAsync(applicationId);
            Assert.Equal(createdTenantId, retry!.Id);
            Assert.NotEqual(firstPassword, retry.TemporaryPassword);
        }

        await using var assertionDb = CreateContext();
        Assert.Single(await assertionDb.TenantWorkspaces.ToListAsync());
        Assert.Single(await assertionDb.Users.ToListAsync());
        Assert.Equal(createdTenantId, (await assertionDb.TenantRegistrationApplications.SingleAsync()).CreatedTenantId);
    }

    [Fact]
    public async Task Simultaneous_expired_verification_rotation_sends_only_the_winning_cas_token()
    {
        var applicationId = await SeedPendingApplicationAsync(expiredVerification: true);
        var barrier = new ApplicationReadBarrier();
        var email = new RecordingEmailSender();

        await using var firstDb = CreateContext(barrier);
        await using var secondDb = CreateContext(barrier);
        var results = await Task.WhenAll(
            CreateService(firstDb, email: email).RegisterTenantAsync(ValidRequest(), RegistrationContext),
            CreateService(secondDb, email: email).RegisterTenantAsync(ValidRequest(), RegistrationContext));

        Assert.All(results, result => Assert.Equal(TenantRegistrationOutcome.Duplicate, result.Outcome));
        var sent = Assert.Single(email.Sent);
        var emailedToken = ExtractToken(sent.Body);

        await using var assertionDb = CreateContext();
        var application = await assertionDb.TenantRegistrationApplications.SingleAsync(x => x.Id == applicationId);
        Assert.True(await CreateService(assertionDb).VerifyRegistrationContactAsync(emailedToken));
        Assert.NotNull(application.VerificationSentAtUtc);
    }

    private async Task<Guid> SeedPendingApplicationAsync(bool expiredVerification = false)
    {
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();
        var application = PendingApplication(expiredVerification);
        db.TenantRegistrationApplications.Add(application);
        await db.SaveChangesAsync();
        return application.Id;
    }

    private static TenantRegistrationApplication PendingApplication(bool expiredVerification = false) => new()
    {
        InstitutionName = "ABC Koleji",
        ContactName = "Ahmet Yilmaz",
        ContactEmail = "info@abckoleji.com",
        ContactEmailNormalized = "info@abckoleji.com",
        Plan = "Starter",
        InstitutionType = InstitutionType.PrivateSchool,
        Status = "pending",
        EstimatedStudents = 250,
        CreatedAtUtc = DateTime.UtcNow,
        VerificationTokenHash = expiredVerification ? "expired-hash" : null,
        VerificationSentAtUtc = expiredVerification ? DateTime.UtcNow.AddDays(-3) : null,
        VerificationExpiresAtUtc = expiredVerification ? DateTime.UtcNow.AddDays(-1) : null,
    };

    private CourseIntellectDbContext CreateContext(DbCommandInterceptor? interceptor = null)
    {
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared,
            DefaultTimeout = 30,
        }.ToString();
        var builder = new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connectionString);
        if (interceptor is not null) builder.AddInterceptors(interceptor);
        return new CourseIntellectDbContext(builder.Options);
    }

    private static PlatformOperationsService CreateService(
        CourseIntellectDbContext db,
        IEmailSender? email = null,
        ITenantSetupDocumentService? setupDocument = null)
        => new(
            db,
            new StubHasher(),
            new StubCaptcha(),
            setupDocument ?? new RecordingSetupDocument(),
            new StubAudit(),
            email ?? new RecordingEmailSender(isConfigured: false),
            new StubEnvironment(),
            new ConfigurationBuilder().AddInMemoryCollection([]).Build(),
            NullLogger<PlatformOperationsService>.Instance);

    private static RegisterTenantRequest ValidRequest() => new(
        "ABC Koleji", "Ahmet Yilmaz", "info@abckoleji.com", "0532 111 22 33",
        "Starter", 250, "PrivateSchool", "token", true);

    private static readonly TenantRegistrationContext RegistrationContext =
        new("203.0.113.7", "concurrency-test", "https://schoolasist.com/kurum-kaydi");

    private static string ExtractToken(string body)
    {
        var match = Regex.Match(body, @"token=([A-Za-z0-9\-_%]+)");
        Assert.True(match.Success);
        return Uri.UnescapeDataString(match.Groups[1].Value);
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (File.Exists(databasePath)) File.Delete(databasePath);
    }

    private sealed class ApplicationReadBarrier : DbCommandInterceptor
    {
        private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int readers;

        public override async ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            DbDataReader result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("tenant_registration_applications", StringComparison.OrdinalIgnoreCase)
                && Interlocked.Increment(ref readers) <= 2)
            {
                if (Volatile.Read(ref readers) >= 2) ready.TrySetResult();
                await ready.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
            }
            return result;
        }
    }

    private sealed class RecordingSetupDocument : ITenantSetupDocumentService
    {
        private int generatedCount;
        public int GeneratedCount => Volatile.Read(ref generatedCount);
        public byte[] Generate(TenantSetupDocumentModel model)
        {
            Interlocked.Increment(ref generatedCount);
            return "%PDF-test"u8.ToArray();
        }
    }

    private sealed class ThrowingSetupDocument : ITenantSetupDocumentService
    {
        public byte[] Generate(TenantSetupDocumentModel model) => throw new InvalidOperationException("render failed");
    }

    private sealed class RecordingEmailSender(bool isConfigured = true) : IEmailSender
    {
        public ConcurrentBag<(string To, string Subject, string Body)> Sent { get; } = [];
        public bool IsConfigured { get; } = isConfigured;
        public Task<bool> SendAsync(string toAddress, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            Sent.Add((toAddress, subject, htmlBody));
            return Task.FromResult(true);
        }
    }

    private sealed class StubHasher : IPasswordHasher
    {
        public string Hash(string password) => $"hashed:{password}";
        public bool Verify(string password, string hash) => hash == $"hashed:{password}";
    }

    private sealed class StubCaptcha : ICaptchaVerificationService
    {
        public Task<CaptchaVerificationResult> VerifyAsync(string? token, string? remoteIp, CancellationToken cancellationToken = default)
            => Task.FromResult(new CaptchaVerificationResult(CaptchaVerificationStatus.Success));
    }

    private sealed class StubAudit : IAuditLogService
    {
        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int limit, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class StubEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
