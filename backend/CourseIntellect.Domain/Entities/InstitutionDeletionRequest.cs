using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Kurum yöneticisinin kurumun tamamen silinmesi talebi. Platform yöneticisinin
/// onayına düşer. Onaylanınca <see cref="FinalizeAtUtc"/> dolduğunda arka plan
/// servisi tenant verisini temizler (finans/eğitim anonim saklanır) — bayrak açıksa.
/// </summary>
public sealed class InstitutionDeletionRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }

    /// <summary>Talebi açan kurum yöneticisi.</summary>
    public Guid RequestedByUserId { get; set; }

    public InstitutionDeletionStatus Status { get; set; } = InstitutionDeletionStatus.PendingPlatformApproval;

    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>İşlem öncesi etkilenecek kullanıcı/dosya/kayıt sayıları (JSON, PII içermez).</summary>
    public string ImpactSnapshotJson { get; set; } = "{}";

    public Guid? DecisionByUserId { get; set; }
    public DateTime? DecisionAtUtc { get; set; }

    /// <summary>Platform reddederse gerekçe.</summary>
    public string? RejectReason { get; set; }

    /// <summary>Onay sonrası otomatik tamamlama anı.</summary>
    public DateTime? FinalizeAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? FailureReason { get; set; }
}
