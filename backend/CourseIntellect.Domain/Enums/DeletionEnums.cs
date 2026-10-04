namespace CourseIntellect.Domain.Enums;

/// <summary>
/// Kişisel hesap silme talebinin yaşam döngüsü.
/// Pending: reauth yapıldı, iptal edilebilir bekleme penceresi işliyor.
/// Scheduled: pencere doldu, finalizer'ın tamamlaması bekleniyor (aynı anlama gelir;
///   finalizer bayrağı kapalıyken talep Scheduled'da bekler, prod'da gerçek silme olmaz).
/// Cancelled: kullanıcı süresi dolmadan vazgeçti.
/// Completed: anonimleştirme + temizlik tamamlandı.
/// Failed: finalize sırasında hata; operatör incelemeli.
/// </summary>
public enum AccountDeletionStatus
{
    Pending = 1,
    Scheduled = 2,
    Cancelled = 3,
    Completed = 4,
    Failed = 5
}

/// <summary>
/// Kurum (tenant) silme talebinin yaşam döngüsü. Kişisel silmeden farklı olarak
/// platform yöneticisi onayı/retti gerektirir.
/// </summary>
public enum InstitutionDeletionStatus
{
    PendingPlatformApproval = 1,
    Approved = 2,
    Rejected = 3,
    Scheduled = 4,
    Completed = 5,
    Failed = 6
}

/// <summary>
/// Talebi kimin işlem kapsamına girdiği. Sıradan roller kurum yöneticisince (yalnız
/// görüntüleme/SLA, reddetme yok); kurum yöneticisinin kendi talebi platform yöneticisince.
/// </summary>
public enum DeletionHandlerKind
{
    None = 0,
    TenantAdmin = 1,
    Platform = 2
}
