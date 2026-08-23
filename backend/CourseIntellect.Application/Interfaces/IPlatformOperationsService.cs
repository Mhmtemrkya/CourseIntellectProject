using CourseIntellect.Application.DTOs.PlatformOperations;

namespace CourseIntellect.Application.Interfaces;

public interface IPlatformOperationsService
{
    Task<PlatformOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TenantWorkspaceDto>> GetTenantsAsync(CancellationToken cancellationToken = default);
    Task<TenantWorkspaceDto> UpsertTenantAsync(Guid? id, UpsertTenantWorkspaceRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SupportTicketDto>> GetSupportTicketsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SupportTicketDto>> GetSupportTicketsByTenantAsync(string tenantName, CancellationToken cancellationToken = default);
    Task<SupportTicketDto> CreateSupportTicketAsync(CreateSupportTicketRequest request, CancellationToken cancellationToken = default);
    Task<SupportTicketDto?> UpdateSupportTicketAsync(Guid id, UpdateSupportTicketRequest request, CancellationToken cancellationToken = default);
    /// <summary>Halka açık (anonim) kurum kaydı başvurusu. Sonucu çağırana nasıl
    /// yansıtacağını controller belirler; servis kayıt varlığını sızdırmaz.</summary>
    Task<RegisterTenantResult> RegisterTenantAsync(
        RegisterTenantRequest request,
        TenantRegistrationContext context,
        CancellationToken cancellationToken = default);
    Task<TenantWorkspaceDto?> ApproveTenantAsync(Guid id, CancellationToken cancellationToken = default);
    /// <summary>Kurum kurulum belgesini yeniden üretir: yeni geçici parola verir,
    /// eskisini geçersiz kılar ve yeni PDF döner.</summary>
    Task<SetupDocumentResult> RegenerateSetupDocumentAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>Kurum kaydı başvurusundaki iletişim adresini doğrular.
    /// Geçersiz/süresi dolmuş/bilinmeyen kod aynı sonucu verir (jeton kâhini olmasın).</summary>
    Task<bool> VerifyRegistrationContactAsync(string? token, CancellationToken cancellationToken = default);

    /// <summary>Kurum kaydı formunda engellenen alan adı / IP listesi.</summary>
    Task<IReadOnlyList<RegistrationBlocklistEntryDto>> GetRegistrationBlocklistAsync(
        CancellationToken cancellationToken = default);

    /// <summary>Kara listeye ekler. Geçersiz tür/değerde <c>null</c> döner.</summary>
    Task<RegistrationBlocklistEntryDto?> AddRegistrationBlocklistEntryAsync(
        AddRegistrationBlocklistRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task<bool> RemoveRegistrationBlocklistEntryAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Başvuruyu kuyrukta "şüpheli" olarak işaretler ya da işareti kaldırır.</summary>
    Task<TenantWorkspaceDto?> SetApplicationSuspiciousAsync(
        Guid id,
        bool isSuspicious,
        string? reason = null,
        CancellationToken cancellationToken = default);

    /// <summary>Başvuruyu (ya da eski bekleyen kurum satırını) reddeder.
    /// <paramref name="reason"/> yalnız platform tarafında saklanır, başvurana gitmez.</summary>
    Task<TenantWorkspaceDto?> RejectTenantAsync(Guid id, string? reason = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteTenantAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ResetTenantDataResult?> ResetTenantDataAsync(
        Guid id,
        string preserveUsername,
        CancellationToken cancellationToken = default);
}
