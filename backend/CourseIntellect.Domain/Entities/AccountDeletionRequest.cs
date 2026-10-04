using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Bir kullanıcının kendi hesabını silme talebi. Kurum (tenant) kapsamlıdır;
/// kurumlar-arası erişim DbContext sorgu filtresiyle kapalıdır.
/// Yönetici/platform bu talebi keyfî reddedemez; <see cref="FinalizeAtUtc"/>
/// dolunca arka plan servisi tamamlar (bayrak açıksa).
/// </summary>
public sealed class AccountDeletionRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }

    /// <summary>Hesabı silinecek kullanıcı.</summary>
    public Guid UserId { get; set; }

    /// <summary>Denormalize anlık görüntü (talep anındaki rol); PII değildir.</summary>
    public string RequesterRole { get; set; } = string.Empty;

    public AccountDeletionStatus Status { get; set; } = AccountDeletionStatus.Pending;

    /// <summary>Talebi hangi makam işleyecek (sıradan rol → kurum yöneticisi, yönetici → platform).</summary>
    public DeletionHandlerKind HandledByKind { get; set; } = DeletionHandlerKind.None;

    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>Reauth (parola) doğrulandığı an. Talep ancak bundan sonra oluşur.</summary>
    public DateTime ReauthenticatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>İptal edilebilir bekleme penceresinin sonu = otomatik tamamlama anı.</summary>
    public DateTime FinalizeAtUtc { get; set; }

    /// <summary>Tek yönetici kendini siliyorsa devredilecek yönetici (handoff). Yoksa null.</summary>
    public Guid? SuccessorAdminUserId { get; set; }

    public DateTime? CancelledAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    /// <summary>Son hata (Failed durumunda operatör için); PII içermez.</summary>
    public string? FailureReason { get; set; }

    /// <summary>Tamamlanınca anonimleştirilerek saklanan kayıt özetleri (JSON, yalnız sayılar).</summary>
    public string? RetainedSummaryJson { get; set; }
}
