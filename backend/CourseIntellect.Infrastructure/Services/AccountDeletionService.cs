using CourseIntellect.Application.DTOs.AccountLifecycle;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AccountDeletionService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    ITenantContext tenantContext,
    IAuditLogService auditLog,
    IConfiguration configuration) : IAccountDeletionService
{
    private const int MaxGraceDays = 30; // KVKK "en geç 30 gün" üst sınırı
    private const string AuditCategory = "account-lifecycle";

    private static readonly AccountDeletionStatus[] ActiveStatuses =
        [AccountDeletionStatus.Pending, AccountDeletionStatus.Scheduled];

    private static readonly string[] RetainedExplanation =
    [
        "Verileriniz hesabınızı kullandığınız sürece saklanır. Silme talebinden 30 gün sonra kalıcı olarak silinir; bu süre içinde talebi iptal edebilirsiniz.",
        "30 gün sonunda profil bilgileriniz, mesajlarınız, bildirimleriniz, yüklediğiniz dosyalar, profil görseliniz ve tüm kişisel tanımlayıcılarınız SİLİNİR.",
        "Tüm oturumlarınız ve bildirim cihaz kayıtlarınız iptal edilir; hesabınıza artık giriş yapılamaz.",
        "Finans (tahsilat, fatura, makbuz) ve eğitim (not, devamsızlık, sınav) kayıtlarındaki kişisel bilgileriniz silinir; geriye kalan tutar/sonuç satırları sizi tanımlamayan anonim kayıtlara dönüştürülür.",
    ];

    public async Task<AccountDeletionStatusDto> RequestAsync(
        Guid userId, string actorName, CreateAccountDeletionRequest request, CancellationToken cancellationToken = default)
    {
        if (!request.Confirm)
        {
            throw new InvalidOperationException("Silme işlemini açıkça onaylamanız gerekir.");
        }

        // IgnoreQueryFilters: çağıran kendi kaydıdır; aktif şube kapsamı seçili olsa bile
        // branch filtresi kullanıcıyı gizlememeli.
        var user = await dbContext.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new InvalidOperationException("Kullanıcı bulunamadı.");
        var tenantId = user.TenantId;

        // Reauth — mevcut parola doğrulanmadan talep oluşmaz.
        if (string.IsNullOrEmpty(request.Password) || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Parola doğrulanamadı.");
        }

        // Tekrarlı talep koruması: aktif talep varsa onu döndür.
        var existing = await dbContext.Set<AccountDeletionRequest>()
            .IgnoreQueryFilters()
            .Where(x => x.UserId == userId && ActiveStatuses.Contains(x.Status))
            .OrderByDescending(x => x.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null)
        {
            return ToStatusDto(existing);
        }

        var isAdmin = user.PrimaryRole == UserRole.Admin;
        var handledBy = isAdmin ? DeletionHandlerKind.Platform : DeletionHandlerKind.TenantAdmin;

        // Tek yönetici kendini siliyorsa: yönetici devri ZORUNLU; süresiz kilidi önler.
        if (isAdmin)
        {
            var otherActiveAdmins = await dbContext.Users.IgnoreQueryFilters().CountAsync(
                x => x.Id != userId
                    && x.TenantId == tenantId
                    && x.PrimaryRole == UserRole.Admin
                    && x.Status == UserStatus.Active
                    && x.DeletedAtUtc == null,
                cancellationToken);

            if (otherActiveAdmins == 0)
            {
                if (request.SuccessorAdminUserId is not Guid successorId)
                {
                    throw new InvalidOperationException(
                        "Kurumun tek yöneticisisiniz. Hesabınızı silmeden önce yönetimi devredeceğiniz bir kullanıcı seçmelisiniz.");
                }

                var successor = await dbContext.Users.IgnoreQueryFilters().FirstOrDefaultAsync(
                    x => x.Id == successorId && x.TenantId == tenantId
                        && x.Status == UserStatus.Active && x.DeletedAtUtc == null,
                    cancellationToken)
                    ?? throw new InvalidOperationException("Devredilecek yönetici bulunamadı.");

                // Güvenlik: yönetim yalnız PERSONEL rolüne devredilebilir (öğrenci/veliye değil).
                if (!IsStaffRole(successor.PrimaryRole))
                {
                    throw new InvalidOperationException("Yönetim yalnız bir personel kullanıcısına devredilebilir.");
                }

                // Yönetici boşluğu olmaması için devir TALEP anında yapılır.
                var previousRole = successor.PrimaryRole;
                successor.PrimaryRole = UserRole.Admin;
                successor.CustomRoleId = null; // özel rol modül tavanı yöneticiyi kısıtlamasın
                successor.SecurityVersion += 1;

                // Kurum künyesindeki yönetici referansını da devret (izlenen varlık → aynı SaveChanges'te yazılır).
                var workspace = await dbContext.Set<TenantWorkspace>()
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
                if (workspace is not null && workspace.AdminUserId == userId)
                {
                    workspace.AdminUserId = successorId;
                }

                await auditLog.LogAsync(userId, actorName, "admin-handoff", AuditCategory,
                    nameof(AppUser), successorId.ToString(),
                    $"from={previousRole} to=Admin (sole-admin deletion)", cancellationToken);
            }
        }

        var now = DateTime.UtcNow;
        var deletionRequest = new AccountDeletionRequest
        {
            TenantId = tenantId ?? tenantContext.CurrentTenantId,
            UserId = userId,
            RequesterRole = user.PrimaryRole.ToString(),
            Status = AccountDeletionStatus.Pending,
            HandledByKind = handledBy,
            RequestedAtUtc = now,
            ReauthenticatedAtUtc = now,
            FinalizeAtUtc = now.AddDays(GraceDays()),
            SuccessorAdminUserId = request.SuccessorAdminUserId,
        };
        dbContext.Set<AccountDeletionRequest>().Add(deletionRequest);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Eşzamanlı çift gönderim benzersiz indekse takılır → 500 yerine mevcut talebi döndür.
            dbContext.ChangeTracker.Clear();
            var concurrent = await dbContext.Set<AccountDeletionRequest>()
                .IgnoreQueryFilters()
                .Where(x => x.UserId == userId && ActiveStatuses.Contains(x.Status))
                .OrderByDescending(x => x.RequestedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
            if (concurrent is not null) return ToStatusDto(concurrent);
            throw;
        }

        await auditLog.LogAsync(userId, actorName, "account-deletion-requested", AuditCategory,
            nameof(AccountDeletionRequest), deletionRequest.Id.ToString(),
            $"role={user.PrimaryRole}; finalizeAtUtc={deletionRequest.FinalizeAtUtc:o}; handledBy={handledBy}",
            cancellationToken);

        return ToStatusDto(deletionRequest);
    }

    public async Task<AccountDeletionStatusDto> GetMineAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var latest = await dbContext.Set<AccountDeletionRequest>()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return latest is null
            ? new AccountDeletionStatusDto { Status = "none", RetainedRecordsExplanation = RetainedExplanation }
            : ToStatusDto(latest);
    }

    public async Task<AccountDeletionStatusDto> CancelMineAsync(Guid userId, string actorName, CancellationToken cancellationToken = default)
    {
        var active = await dbContext.Set<AccountDeletionRequest>()
            .Where(x => x.UserId == userId && ActiveStatuses.Contains(x.Status))
            .OrderByDescending(x => x.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("İptal edilecek aktif bir silme talebiniz yok.");

        active.Status = AccountDeletionStatus.Cancelled;
        active.CancelledAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLog.LogAsync(userId, actorName, "account-deletion-cancelled", AuditCategory,
            nameof(AccountDeletionRequest), active.Id.ToString(), "user cancelled", cancellationToken);

        return ToStatusDto(active);
    }

    // Yönetim devredilebilecek PERSONEL rolleri (öğrenci/veli hariç).
    private static readonly UserRole[] StaffRoles =
        [UserRole.Admin, UserRole.Administrative, UserRole.BranchManager, UserRole.Teacher, UserRole.Accounting, UserRole.Cafeteria];

    private static bool IsStaffRole(UserRole role) => StaffRoles.Contains(role);

    public async Task<IReadOnlyList<SuccessorCandidateDto>> GetSuccessorCandidatesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var tenantId = tenantContext.CurrentTenantId;
        var candidates = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId
                && x.Id != userId
                && x.Status == UserStatus.Active
                && x.DeletedAtUtc == null
                && StaffRoles.Contains(x.PrimaryRole))
            .OrderBy(x => x.FullName)
            .Select(x => new SuccessorCandidateDto { Id = x.Id, FullName = x.FullName, Role = x.PrimaryRole.ToString() })
            .ToListAsync(cancellationToken);
        return candidates;
    }

    public async Task<IReadOnlyList<AccountDeletionQueueItemDto>> GetTenantQueueAsync(CancellationToken cancellationToken = default)
    {
        // Tenant sorgu filtresi otomatik kapsar; yalnız görüntüleme.
        var items = await dbContext.Set<AccountDeletionRequest>()
            .Where(x => ActiveStatuses.Contains(x.Status))
            .OrderBy(x => x.FinalizeAtUtc)
            .ToListAsync(cancellationToken);
        return await ToQueueDtosAsync(items, cancellationToken);
    }

    public async Task<IReadOnlyList<AccountDeletionQueueItemDto>> GetPlatformQueueAsync(CancellationToken cancellationToken = default)
    {
        // Platform bağlamı: tenant filtresi yok → IgnoreQueryFilters; yalnız yönetici talepleri.
        var items = await dbContext.Set<AccountDeletionRequest>()
            .IgnoreQueryFilters()
            .Where(x => x.HandledByKind == DeletionHandlerKind.Platform && ActiveStatuses.Contains(x.Status))
            .OrderBy(x => x.FinalizeAtUtc)
            .ToListAsync(cancellationToken);
        return await ToQueueDtosAsync(items, cancellationToken);
    }

    private int GraceDays()
    {
        // Varsayılan 30 gün: KVKK "en geç 30 gün" + App Store uyumlu iptal edilebilir pencere.
        // Kullanıcı bu süre boyunca hesabını geri alabilir; süre dolunca kalıcı silinir.
        var days = configuration.GetValue("AccountDeletion:GracePeriodDays", 30);
        return Math.Clamp(days, 1, MaxGraceDays);
    }

    private async Task<IReadOnlyList<AccountDeletionQueueItemDto>> ToQueueDtosAsync(
        List<AccountDeletionRequest> items, CancellationToken cancellationToken)
    {
        if (items.Count == 0) return [];
        var userIds = items.Select(x => x.UserId).ToList();
        var names = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(x => userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.FullName, cancellationToken);

        return items.Select(x => new AccountDeletionQueueItemDto
        {
            Id = x.Id,
            UserId = x.UserId,
            UserDisplayName = names.TryGetValue(x.UserId, out var n) ? n : string.Empty,
            RequesterRole = x.RequesterRole,
            Status = x.Status.ToString(),
            RequestedAtUtc = x.RequestedAtUtc,
            FinalizeAtUtc = x.FinalizeAtUtc,
            RemainingDays = RemainingDays(x.FinalizeAtUtc),
            RequiresPlatform = x.HandledByKind == DeletionHandlerKind.Platform,
        }).ToList();
    }

    private static int RemainingDays(DateTime finalizeAtUtc)
        => Math.Max(0, (int)Math.Ceiling((finalizeAtUtc - DateTime.UtcNow).TotalDays));

    private static AccountDeletionStatusDto ToStatusDto(AccountDeletionRequest r) => new()
    {
        Id = r.Id,
        Status = r.Status.ToString(),
        RequestedAtUtc = r.RequestedAtUtc,
        FinalizeAtUtc = r.FinalizeAtUtc,
        RemainingDays = RemainingDays(r.FinalizeAtUtc),
        CanCancel = ActiveStatuses.Contains(r.Status),
        RetainedRecordsExplanation = RetainedExplanation,
    };
}
