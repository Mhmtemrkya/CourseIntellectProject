namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Merkezi idari denetim kaydı: kim, ne zaman, hangi varlıkta ne yaptı.
/// İdari işlemler için tek kaynak (KVKK/uyum ve izlenebilirlik).
/// </summary>
public sealed class AuditLogEntry : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    // Şube izolasyonu: şube müdürü yalnızca kendi şubesinin kayıtlarını görür;
    // kurum sahibi tüm şubeleri görür (X-Branch-Filter ile şube şube odaklanabilir).
    public Guid? BranchId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Category { get; set; } = "Admin";
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;

    /// <summary>Değişiklik öncesi durum (JSON). Yalnızca güncelleme kayıtlarında dolar.</summary>
    public string? BeforeValue { get; set; }

    /// <summary>Değişiklik sonrası durum (JSON).</summary>
    public string? AfterValue { get; set; }

    /// <summary>İsteğin geldiği IP (proxy arkasında X-Forwarded-For'un ilk adresi).</summary>
    public string? IpAddress { get; set; }

    /// <summary>İstemci tanımı (User-Agent) — hangi cihaz/uygulama.</summary>
    public string? UserAgent { get; set; }

    /// <summary>
    /// İşlemi yapanın O ANDAKİ rolü. Kişinin rolü sonradan değişebildiği için
    /// kullanıcı kaydından okunamaz; olay anında dondurulur. Bu alan eklenmeden
    /// önceki kayıtlarda boştur — geriye dönük doldurulmaz.
    /// </summary>
    public string? ActorRole { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
