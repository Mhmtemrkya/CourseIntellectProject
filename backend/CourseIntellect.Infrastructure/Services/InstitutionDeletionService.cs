using System.Text.Json;
using CourseIntellect.Application.DTOs.AccountLifecycle;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Infrastructure.Services;

public sealed class InstitutionDeletionService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    ITenantContext tenantContext,
    IAuditLogService auditLog,
    IConfiguration configuration) : IInstitutionDeletionService
{
    private const int MaxGraceDays = 30;
    private const string AuditCategory = "account-lifecycle";

    private static readonly InstitutionDeletionStatus[] ActiveStatuses =
        [InstitutionDeletionStatus.PendingPlatformApproval, InstitutionDeletionStatus.Approved, InstitutionDeletionStatus.Scheduled];

    public async Task<InstitutionDeletionStatusDto> RequestAsync(
        Guid requestedByUserId, string actorName, CreateInstitutionDeletionRequest request, CancellationToken cancellationToken = default)
    {
        if (!request.Confirm)
        {
            throw new InvalidOperationException("Kurum silme işlemini açıkça onaylamanız gerekir.");
        }

        if (tenantContext.CurrentTenantId is not Guid tenantId)
        {
            throw new InvalidOperationException("Aktif kurum bağlamı yok.");
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == requestedByUserId, cancellationToken)
            ?? throw new InvalidOperationException("Kullanıcı bulunamadı.");
        if (user.PrimaryRole != UserRole.Admin)
        {
            throw new UnauthorizedAccessException("Yalnız kurum yöneticisi kurum silme talebi oluşturabilir.");
        }
        if (string.IsNullOrEmpty(request.Password) || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Parola doğrulanamadı.");
        }

        var existing = await dbContext.Set<InstitutionDeletionRequest>()
            .Where(x => ActiveStatuses.Contains(x.Status))
            .OrderByDescending(x => x.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null)
        {
            return await ToStatusDtoAsync(existing, cancellationToken);
        }

        var impact = await BuildImpactAsync(cancellationToken);
        var deletionRequest = new InstitutionDeletionRequest
        {
            TenantId = tenantId,
            RequestedByUserId = requestedByUserId,
            Status = InstitutionDeletionStatus.PendingPlatformApproval,
            RequestedAtUtc = DateTime.UtcNow,
            ImpactSnapshotJson = JsonSerializer.Serialize(impact),
        };
        dbContext.Set<InstitutionDeletionRequest>().Add(deletionRequest);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLog.LogAsync(requestedByUserId, actorName, "institution-deletion-requested", AuditCategory,
            nameof(InstitutionDeletionRequest), deletionRequest.Id.ToString(),
            $"impactUsers={impact.UserCount}; students={impact.StudentCount}", cancellationToken);

        return await ToStatusDtoAsync(deletionRequest, cancellationToken);
    }

    public async Task<InstitutionDeletionStatusDto> GetMineAsync(CancellationToken cancellationToken = default)
    {
        var latest = await dbContext.Set<InstitutionDeletionRequest>()
            .OrderByDescending(x => x.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        return latest is null
            ? new InstitutionDeletionStatusDto { Status = "none" }
            : await ToStatusDtoAsync(latest, cancellationToken);
    }

    public async Task<IReadOnlyList<InstitutionDeletionQueueItemDto>> GetPlatformQueueAsync(CancellationToken cancellationToken = default)
    {
        var items = await dbContext.Set<InstitutionDeletionRequest>()
            .IgnoreQueryFilters()
            .Where(x => ActiveStatuses.Contains(x.Status))
            .OrderBy(x => x.RequestedAtUtc)
            .ToListAsync(cancellationToken);
        if (items.Count == 0) return [];

        var tenantIds = items.Where(x => x.TenantId.HasValue).Select(x => x.TenantId!.Value).ToList();
        var tenantNames = await dbContext.Set<TenantWorkspace>()
            .IgnoreQueryFilters()
            .Where(x => tenantIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        return items.Select(x => new InstitutionDeletionQueueItemDto
        {
            Id = x.Id,
            TenantId = x.TenantId ?? Guid.Empty,
            TenantName = x.TenantId is Guid tid && tenantNames.TryGetValue(tid, out var n) ? n : string.Empty,
            Status = x.Status.ToString(),
            RequestedAtUtc = x.RequestedAtUtc,
            FinalizeAtUtc = x.FinalizeAtUtc,
            Impact = DeserializeImpact(x.ImpactSnapshotJson),
        }).ToList();
    }

    public async Task<InstitutionDeletionStatusDto> DecideAsync(
        Guid requestId, Guid platformUserId, string actorName, InstitutionDeletionDecisionRequest decision, CancellationToken cancellationToken = default)
    {
        var deletionRequest = await dbContext.Set<InstitutionDeletionRequest>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == requestId, cancellationToken)
            ?? throw new InvalidOperationException("Talep bulunamadı.");

        if (deletionRequest.Status != InstitutionDeletionStatus.PendingPlatformApproval)
        {
            throw new InvalidOperationException("Talep zaten işleme alınmış.");
        }

        deletionRequest.DecisionByUserId = platformUserId;
        deletionRequest.DecisionAtUtc = DateTime.UtcNow;

        if (decision.Approve)
        {
            deletionRequest.Status = InstitutionDeletionStatus.Scheduled;
            deletionRequest.FinalizeAtUtc = DateTime.UtcNow.AddDays(GraceDays());
        }
        else
        {
            if (string.IsNullOrWhiteSpace(decision.RejectReason))
            {
                throw new InvalidOperationException("Reddetme gerekçesi zorunludur.");
            }
            deletionRequest.Status = InstitutionDeletionStatus.Rejected;
            deletionRequest.RejectReason = decision.RejectReason.Trim();
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLog.LogAsync(platformUserId, actorName,
            decision.Approve ? "institution-deletion-approved" : "institution-deletion-rejected",
            AuditCategory, nameof(InstitutionDeletionRequest), deletionRequest.Id.ToString(),
            decision.Approve ? $"finalizeAtUtc={deletionRequest.FinalizeAtUtc:o}" : "rejected", cancellationToken);

        return await ToStatusDtoAsync(deletionRequest, cancellationToken);
    }

    private int GraceDays()
    {
        // Varsayılan 30 gün (KVKK üst sınırı; onay sonrası iptal/işleme penceresi).
        var days = configuration.GetValue("InstitutionDeletion:GracePeriodDays", 30);
        return Math.Clamp(days, 1, MaxGraceDays);
    }

    private async Task<InstitutionDeletionImpactDto> BuildImpactAsync(CancellationToken cancellationToken)
    {
        return new InstitutionDeletionImpactDto
        {
            UserCount = await dbContext.Users.CountAsync(x => x.DeletedAtUtc == null, cancellationToken),
            StudentCount = await dbContext.Students.CountAsync(cancellationToken),
            FileCount = await dbContext.ContentItems.CountAsync(cancellationToken)
                + await dbContext.AdminDocuments.CountAsync(cancellationToken),
            FinanceRecordCount = await dbContext.FinancePayments.CountAsync(cancellationToken),
            EducationRecordCount = await dbContext.ExamResults.CountAsync(cancellationToken)
                + await dbContext.AttendanceEntries.CountAsync(cancellationToken),
        };
    }

    private async Task<InstitutionDeletionStatusDto> ToStatusDtoAsync(InstitutionDeletionRequest r, CancellationToken cancellationToken)
    {
        // Durum sorgusunda güncel etki yeniden hesaplanabilir; snapshot'ı döndürmek yeterli.
        await Task.CompletedTask;
        return new InstitutionDeletionStatusDto
        {
            Id = r.Id,
            Status = r.Status.ToString(),
            RequestedAtUtc = r.RequestedAtUtc,
            FinalizeAtUtc = r.FinalizeAtUtc,
            RejectReason = r.RejectReason,
            Impact = DeserializeImpact(r.ImpactSnapshotJson),
        };
    }

    private static InstitutionDeletionImpactDto DeserializeImpact(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<InstitutionDeletionImpactDto>(json) ?? new InstitutionDeletionImpactDto();
        }
        catch (JsonException)
        {
            return new InstitutionDeletionImpactDto();
        }
    }
}
