using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CourseIntellect.Tests;

public sealed class PostgreSqlReceiptProviderTests
{
    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("COURSE_INTELLECT_POSTGRES_TEST");

    [SkippableFact]
    public async Task LatestMigration_IsAppliedAndCreatesReceiptAndIdentitySchema()
    {
        Skip.If(string.IsNullOrEmpty(ConnectionString),
            "COURSE_INTELLECT_POSTGRES_TEST tanımlı değil — gerçek PostgreSQL testi atlandı.");
        var connectionString = ConnectionString!;

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                EXISTS (SELECT 1 FROM "__EFMigrationsHistory"
                        WHERE "MigrationId" = '20260824060000_HardenDomainIdentityReceiptsAndDrivingProvenance'),
                (SELECT count(*) FROM information_schema.columns
                 WHERE (table_name, column_name) IN (
                    ('student_question_threads', 'StudentUserId'),
                    ('student_question_threads', 'TeacherUserId'),
                    ('student_question_replies', 'SenderUserId'),
                    ('message_threads', 'ParticipantOneUserId'),
                    ('message_threads', 'ParticipantTwoUserId'),
                    ('message_items', 'SenderUserId'),
                    ('homework_submissions', 'StudentUserId'),
                    ('driving_lesson_ledger_entries', 'DrivingChargeId'))),
                to_regclass('public.finance_receipt_sequences') IS NOT NULL,
                EXISTS (SELECT 1 FROM pg_indexes
                        WHERE indexname = 'IX_finance_payments_tenant_id_ReceiptNo'
                          AND indexdef LIKE 'CREATE UNIQUE INDEX%'),
                EXISTS (SELECT 1 FROM pg_indexes
                        WHERE indexname = 'IX_finance_receipt_sequences_Period'
                          AND indexdef LIKE 'CREATE UNIQUE INDEX%');
            """;
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.True(reader.GetBoolean(0));
        Assert.Equal(8, reader.GetInt64(1));
        Assert.True(reader.GetBoolean(2));
        Assert.True(reader.GetBoolean(3));
        Assert.True(reader.GetBoolean(4));
    }

    [SkippableFact]
    public async Task SeparateNpgsqlContexts_AllocateUniqueContiguousReceiptNumbersConcurrently()
    {
        Skip.If(string.IsNullOrEmpty(ConnectionString),
            "COURSE_INTELLECT_POSTGRES_TEST tanımlı değil — gerçek PostgreSQL testi atlandı.");
        var connectionString = ConnectionString!;
        var month = DateTime.UtcNow.ToString("yyyyMM");

        await using (var cleanup = new NpgsqlConnection(connectionString))
        {
            await cleanup.OpenAsync();
            await using var command = cleanup.CreateCommand();
            command.CommandText = "DELETE FROM finance_receipt_sequences WHERE \"Period\" = @period";
            command.Parameters.AddWithValue("period", $"legacy:{month}");
            await command.ExecuteNonQueryAsync();
        }

        var tasks = Enumerable.Range(0, 20).Select(async _ =>
        {
            var options = new DbContextOptionsBuilder<CourseIntellectDbContext>()
                .UseNpgsql(connectionString)
                .Options;
            await using var context = new CourseIntellectDbContext(options);
            return await CreateService(context).NextReceiptNumberAsync();
        });

        var receipts = await Task.WhenAll(tasks);
        Assert.Equal(20, receipts.Distinct().Count());
        Assert.Equal(Enumerable.Range(1, 20), receipts
            .Select(value => int.Parse(value[^5..]))
            .OrderBy(value => value));
    }

    private static StudentFinanceService CreateService(CourseIntellectDbContext context)
    {
        var audit = new NoopAuditLog();
        return new StudentFinanceService(context, new NoopParentNotifier(), audit,
            new InstitutionProfileService(context, new EmptyTenantContext(), audit));
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
