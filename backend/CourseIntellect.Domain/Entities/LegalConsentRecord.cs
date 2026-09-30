namespace CourseIntellect.Domain.Entities;

/// <summary>
/// KVKK/yasal metin onay kararının sunucu kaydı (ispat için). Eklemeli tutulur:
/// her karar ayrı satırdır, geçmiş karar silinmez/güncellenmez. Kullanıcının
/// güncel kararı, geçerli metin sürümündeki en son satırdır.
/// </summary>
public sealed class LegalConsentRecord : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>Onaylanan metin sürümü (ör. "2026-05-02.kvkk.v1").</summary>
    public string ConsentVersion { get; set; } = string.Empty;

    /// <summary>"accepted" ya da "declined".</summary>
    public string Status { get; set; } = string.Empty;

    // Zorunlu olmayan açık rızalar.
    public bool Marketing { get; set; }
    public bool Push { get; set; }
    public bool Analytics { get; set; }

    /// <summary>Kararın verildiği istemci: "desktop", "mobile" ya da "web".</summary>
    public string Platform { get; set; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;

    /// <summary>İstemcinin bildirdiği karar anı (mobilde karar girişten önce alınır).</summary>
    public DateTime? ClientDecidedAtUtc { get; set; }

    /// <summary>Sunucunun kaydı aldığı an (güvenilir zaman damgası).</summary>
    public DateTime RecordedAtUtc { get; set; } = DateTime.UtcNow;
}
