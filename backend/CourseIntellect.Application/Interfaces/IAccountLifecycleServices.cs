using CourseIntellect.Application.DTOs.AccountLifecycle;

namespace CourseIntellect.Application.Interfaces;

/// <summary>Kişisel hesap silme talepleri (oluşturma, durum, iptal, kuyruklar).</summary>
public interface IAccountDeletionService
{
    Task<AccountDeletionStatusDto> RequestAsync(
        Guid userId, string actorName, CreateAccountDeletionRequest request, CancellationToken cancellationToken = default);

    Task<AccountDeletionStatusDto> GetMineAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<AccountDeletionStatusDto> CancelMineAsync(Guid userId, string actorName, CancellationToken cancellationToken = default);

    /// <summary>Tek yönetici kendini silerken yönetimi devredebileceği aktif kullanıcılar.</summary>
    Task<IReadOnlyList<SuccessorCandidateDto>> GetSuccessorCandidatesAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Kurum yöneticisi görünümü: kurumdaki sıradan rol talepleri (yalnız görüntüleme/SLA).</summary>
    Task<IReadOnlyList<AccountDeletionQueueItemDto>> GetTenantQueueAsync(CancellationToken cancellationToken = default);

    /// <summary>Platform görünümü: kurum yöneticilerinin kendi hesap silme talepleri.</summary>
    Task<IReadOnlyList<AccountDeletionQueueItemDto>> GetPlatformQueueAsync(CancellationToken cancellationToken = default);
}

/// <summary>Kurum (tenant) silme talepleri; platform yöneticisi onayı gerektirir.</summary>
public interface IInstitutionDeletionService
{
    Task<InstitutionDeletionStatusDto> RequestAsync(
        Guid requestedByUserId, string actorName, CreateInstitutionDeletionRequest request, CancellationToken cancellationToken = default);

    Task<InstitutionDeletionStatusDto> GetMineAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InstitutionDeletionQueueItemDto>> GetPlatformQueueAsync(CancellationToken cancellationToken = default);

    Task<InstitutionDeletionStatusDto> DecideAsync(
        Guid requestId, Guid platformUserId, string actorName, InstitutionDeletionDecisionRequest decision, CancellationToken cancellationToken = default);
}

/// <summary>
/// Yıkıcı tamamlama motoru: anonimleştirme + temizlik + oturum/token/push iptali.
/// Yalnız arka plan finalizer tarafından, config bayrağı açıkken çağrılır.
/// Üretimde bayrak kapalı → gerçek silme yapılmaz.
/// </summary>
public interface IAccountLifecycleService
{
    /// <summary>Tek kullanıcıyı anonimleştirir/temizler; korunan kayıt özetini (JSON) döner.</summary>
    Task<string> FinalizeAccountDeletionAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Tüm tenant verisini temizler (finans/eğitim anonim saklanır).</summary>
    Task FinalizeInstitutionDeletionAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
